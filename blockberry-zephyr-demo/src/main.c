#include <errno.h>
#include <stdbool.h>
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
		"Try: 1 + 2, millis(), led(true), button()\n"
		"Multi-line upload: :begin ... :end\n";
	static const char script_ready[] = "[script] receiving\n";
	static const char script_aborted[] = "[script] aborted\n";
	static const char script_too_large[] = "[script] too large; aborted\n";
	static char script[CONFIG_BLOCKBERRY_REPL_SCRIPT_SIZE];
	char line[CONFIG_BLOCKBERRY_REPL_LINE_SIZE];
	size_t script_length = 0;
	bool collecting_script = false;
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
			if (!collecting_script && strcmp(line, ":begin") == 0) {
				collecting_script = true;
				script_length = 0;
				bb_transport_write(script_ready, sizeof(script_ready) - 1);
				continue;
			}

			if (collecting_script && strcmp(line, ":abort") == 0) {
				collecting_script = false;
				script_length = 0;
				bb_transport_write(script_aborted, sizeof(script_aborted) - 1);
			} else if (collecting_script && strcmp(line, ":end") == 0) {
				collecting_script = false;
				if (script_length > 0) {
					(void)bb_repl_eval(script, script_length);
				}
				script_length = 0;
			} else if (collecting_script) {
				size_t line_length = (size_t)err;

				if (script_length + line_length + 1 >= sizeof(script)) {
					collecting_script = false;
					script_length = 0;
					bb_transport_write(script_too_large,
							   sizeof(script_too_large) - 1);
				} else {
					memcpy(script + script_length, line, line_length);
					script_length += line_length;
					script[script_length++] = '\n';
					continue;
				}
			} else {
				(void)bb_repl_eval(line, (size_t)err);
			}
		} else if (err != -EINTR) {
			LOG_WRN("REPL receive failed: %d", err);
		}
		bb_transport_prompt();
	}

	return 0;
}
