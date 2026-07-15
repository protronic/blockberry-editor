#include "repl_transport.h"

#include <errno.h>
#include <string.h>

#include <zephyr/bluetooth/bluetooth.h>
#include <zephyr/bluetooth/conn.h>
#include <zephyr/bluetooth/gatt.h>
#include <zephyr/bluetooth/uuid.h>
#include <zephyr/kernel.h>
#include <zephyr/logging/log.h>

LOG_MODULE_REGISTER(bb_nus, LOG_LEVEL_INF);

#define BT_UUID_NUS_SERVICE_VAL \
	BT_UUID_128_ENCODE(0x6e400001, 0xb5a3, 0xf393, 0xe0a9, 0xe50e24dcca9e)
#define BT_UUID_NUS_RX_VAL \
	BT_UUID_128_ENCODE(0x6e400002, 0xb5a3, 0xf393, 0xe0a9, 0xe50e24dcca9e)
#define BT_UUID_NUS_TX_VAL \
	BT_UUID_128_ENCODE(0x6e400003, 0xb5a3, 0xf393, 0xe0a9, 0xe50e24dcca9e)

#define BT_UUID_NUS_SERVICE BT_UUID_DECLARE_128(BT_UUID_NUS_SERVICE_VAL)
#define BT_UUID_NUS_RX      BT_UUID_DECLARE_128(BT_UUID_NUS_RX_VAL)
#define BT_UUID_NUS_TX      BT_UUID_DECLARE_128(BT_UUID_NUS_TX_VAL)

#if defined(CONFIG_BLOCKBERRY_NUS_REQUIRE_ENCRYPTION)
#define NUS_RX_PERMISSIONS BT_GATT_PERM_WRITE_ENCRYPT
#else
#define NUS_RX_PERMISSIONS BT_GATT_PERM_WRITE
#endif

static struct bt_conn *active_connection;
static bool notifications_enabled;
static char rx_line[CONFIG_BLOCKBERRY_REPL_LINE_SIZE];
static size_t rx_length;
K_MUTEX_DEFINE(nus_mutex);

static void ccc_changed(const struct bt_gatt_attr *attr, uint16_t value)
{
	ARG_UNUSED(attr);
	notifications_enabled = (value == BT_GATT_CCC_NOTIFY);
}

static ssize_t rx_written(struct bt_conn *conn, const struct bt_gatt_attr *attr,
			  const void *buffer, uint16_t length, uint16_t offset,
			  uint8_t flags)
{
	const uint8_t *bytes = buffer;

	ARG_UNUSED(conn);
	ARG_UNUSED(attr);
	ARG_UNUSED(flags);

	if (offset != 0U) {
		return BT_GATT_ERR(BT_ATT_ERR_INVALID_OFFSET);
	}

	k_mutex_lock(&nus_mutex, K_FOREVER);
	for (uint16_t index = 0; index < length; ++index) {
		uint8_t byte = bytes[index];

		if (byte == '\r' || byte == '\n') {
			if (rx_length > 0U) {
				int err = bb_transport_submit((const uint8_t *)rx_line, rx_length);

				if (err != 0) {
					LOG_WRN("REPL queue rejected NUS line: %d", err);
				}
				rx_length = 0U;
			}
			continue;
		}

		if (rx_length + 1U >= sizeof(rx_line)) {
			LOG_WRN("NUS REPL line too long; dropping it");
			rx_length = 0U;
			continue;
		}
		rx_line[rx_length++] = (char)byte;
	}
	k_mutex_unlock(&nus_mutex);

	return length;
}

BT_GATT_SERVICE_DEFINE(nus_service,
	BT_GATT_PRIMARY_SERVICE(BT_UUID_NUS_SERVICE),
	BT_GATT_CHARACTERISTIC(BT_UUID_NUS_TX, BT_GATT_CHRC_NOTIFY,
			       BT_GATT_PERM_NONE, NULL, NULL, NULL),
	BT_GATT_CCC(ccc_changed, BT_GATT_PERM_READ | BT_GATT_PERM_WRITE),
	BT_GATT_CHARACTERISTIC(BT_UUID_NUS_RX,
			       BT_GATT_CHRC_WRITE | BT_GATT_CHRC_WRITE_WITHOUT_RESP,
			       NUS_RX_PERMISSIONS, NULL, rx_written, NULL)
);

static void connected(struct bt_conn *conn, uint8_t error)
{
	if (error != 0U) {
		LOG_WRN("BLE connection failed: 0x%02x", error);
		return;
	}

	k_mutex_lock(&nus_mutex, K_FOREVER);
	if (active_connection != NULL) {
		bt_conn_unref(active_connection);
	}
	active_connection = bt_conn_ref(conn);
	k_mutex_unlock(&nus_mutex);

	LOG_INF("NUS client connected");
}

static void disconnected(struct bt_conn *conn, uint8_t reason)
{
	k_mutex_lock(&nus_mutex, K_FOREVER);
	if (active_connection == conn) {
		bt_conn_unref(active_connection);
		active_connection = NULL;
		notifications_enabled = false;
		rx_length = 0U;
	}
	k_mutex_unlock(&nus_mutex);

	LOG_INF("NUS client disconnected: 0x%02x", reason);
}

BT_CONN_CB_DEFINE(connection_callbacks) = {
	.connected = connected,
	.disconnected = disconnected,
};

int bb_ble_nus_init(void)
{
	static const struct bt_data advertising_data[] = {
		BT_DATA_BYTES(BT_DATA_FLAGS, BT_LE_AD_GENERAL | BT_LE_AD_NO_BREDR),
		BT_DATA(BT_DATA_NAME_COMPLETE, CONFIG_BT_DEVICE_NAME,
			sizeof(CONFIG_BT_DEVICE_NAME) - 1),
	};
	static const struct bt_data scan_response[] = {
		BT_DATA_BYTES(BT_DATA_UUID128_ALL, BT_UUID_NUS_SERVICE_VAL),
	};
	int err;

	err = bt_enable(NULL);
	if (err != 0) {
		LOG_ERR("Bluetooth initialization failed: %d", err);
		return err;
	}

	err = bt_le_adv_start(BT_LE_ADV_CONN_FAST_1,
			      advertising_data, ARRAY_SIZE(advertising_data),
			      scan_response, ARRAY_SIZE(scan_response));
	if (err != 0) {
		LOG_ERR("NUS advertising failed: %d", err);
		return err;
	}

	LOG_INF("Advertising '%s' with Nordic UART Service", CONFIG_BT_DEVICE_NAME);
	return 0;
}

void bb_ble_nus_write(const uint8_t *data, size_t length)
{
	struct bt_conn *connection = NULL;
	size_t offset = 0U;

	k_mutex_lock(&nus_mutex, K_FOREVER);
	if (active_connection != NULL && notifications_enabled) {
		connection = bt_conn_ref(active_connection);
	}
	k_mutex_unlock(&nus_mutex);

	if (connection == NULL) {
		return;
	}

	while (offset < length) {
		size_t payload = MIN(length - offset, bt_gatt_get_mtu(connection) - 3U);
		int err = bt_gatt_notify(connection, &nus_service.attrs[2],
					 data + offset, payload);

		if (err != 0) {
			LOG_WRN("NUS notification failed: %d", err);
			break;
		}
		offset += payload;
		k_sleep(K_MSEC(2));
	}

	bt_conn_unref(connection);
}
