#include <errno.h>
#include <string.h>

#include <zephyr/kernel.h>
#include <zephyr/logging/log.h>

#include "berry_repl.h"
#include "repl_transport.h"

LOG_MODULE_REGISTER(blockberry_demo, LOG_LEVEL_INF);

int main(void)
{
	static const char banner[] =
		"\nBlockBerry Zephyr REPL\n"
		"Try: 1 + 2, millis(), led(true), button()\n";
	char line[CONFIG_BLOCKBERRY_REPL_LINE_SIZE];
	int err;

	err = bb_transport_init();
	if (err != 0) {
		LOG_ERR("REPL transport initialization failed: %d", err);
		return err;
	}

#if defined(CONFIG_BT)
	err = bb_ble_nus_init();
	if (err != 0) {
		LOG_ERR("BLE NUS initialization failed: %d", err);
		return err;
	}
#endif

	err = bb_repl_init();
	if (err != 0) {
		LOG_ERR("Berry VM initialization failed: %d", err);
		return err;
	}

	bb_transport_write(banner, sizeof(banner) - 1);
	bb_transport_prompt();

	for (;;) {
		err = bb_transport_receive(line, sizeof(line));
		if (err > 0) {
			(void)bb_repl_eval(line, (size_t)err);
		} else if (err != -EINTR) {
			LOG_WRN("REPL receive failed: %d", err);
		}
		bb_transport_prompt();
	}

	return 0;
}
