#include "repl_transport.h"

#include <errno.h>
#include <string.h>

#include <zephyr/console/console.h>
#include <zephyr/device.h>
#include <zephyr/devicetree.h>
#include <zephyr/drivers/uart.h>
#include <zephyr/kernel.h>

static const struct device *const console_device =
	DEVICE_DT_GET(DT_CHOSEN(zephyr_console));

struct repl_message {
	uint16_t length;
	char data[CONFIG_BLOCKBERRY_REPL_LINE_SIZE];
};

K_MSGQ_DEFINE(repl_queue, sizeof(struct repl_message),
	      CONFIG_BLOCKBERRY_REPL_QUEUE_DEPTH, sizeof(void *));

K_THREAD_STACK_DEFINE(console_stack, 1024);
static struct k_thread console_thread;

static void console_rx(void *unused1, void *unused2, void *unused3)
{
	ARG_UNUSED(unused1);
	ARG_UNUSED(unused2);
	ARG_UNUSED(unused3);

	console_getline_init();

	for (;;) {
		char *line = console_getline();

		if (line != NULL) {
			(void)bb_transport_submit((const uint8_t *)line, strlen(line));
		}
	}
}

int bb_transport_init(void)
{
	k_thread_create(&console_thread, console_stack,
			K_THREAD_STACK_SIZEOF(console_stack), console_rx,
			NULL, NULL, NULL, 8, 0, K_NO_WAIT);
	k_thread_name_set(&console_thread, "bb_console_rx");
	return 0;
}

int bb_transport_submit(const uint8_t *data, size_t length)
{
	struct repl_message message = { 0 };

	if (data == NULL || length == 0) {
		return -EINVAL;
	}
	if (length >= sizeof(message.data)) {
		return -EMSGSIZE;
	}

	memcpy(message.data, data, length);
	message.data[length] = '\0';
	message.length = (uint16_t)length;

	return k_msgq_put(&repl_queue, &message, K_NO_WAIT);
}

int bb_transport_receive(char *buffer, size_t capacity)
{
	struct repl_message message;
	int err;

	if (buffer == NULL || capacity == 0) {
		return -EINVAL;
	}

	err = k_msgq_get(&repl_queue, &message, K_FOREVER);
	if (err != 0) {
		return err;
	}
	if ((size_t)message.length + 1 > capacity) {
		return -ENOSPC;
	}

	memcpy(buffer, message.data, message.length + 1);
	return message.length;
}

void bb_transport_write(const char *data, size_t length)
{
	if (data == NULL || length == 0) {
		return;
	}

	if (device_is_ready(console_device)) {
		for (size_t index = 0; index < length; ++index) {
			uart_poll_out(console_device, data[index]);
		}
	}

#if defined(CONFIG_BT)
	bb_ble_nus_write((const uint8_t *)data, length);
#endif
}

void bb_transport_prompt(void)
{
	bb_transport_write("> ", 2);
}
