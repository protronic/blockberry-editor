#include "berry_repl.h"

#include <errno.h>
#include <stdbool.h>
#include <stdio.h>
#include <string.h>

#include <zephyr/drivers/gpio.h>
#include <zephyr/kernel.h>

#include "berry.h"

static bvm *repl_vm;

static const struct gpio_dt_spec led =
	GPIO_DT_SPEC_GET_OR(DT_ALIAS(led0), gpios, { 0 });
static const struct gpio_dt_spec button =
	GPIO_DT_SPEC_GET_OR(DT_ALIAS(sw0), gpios, { 0 });

static int native_millis(bvm *vm)
{
	be_pushint(vm, (bint)k_uptime_get());
	be_return(vm);
}

static int native_led(bvm *vm)
{
	if (led.port == NULL || !device_is_ready(led.port)) {
		be_raise(vm, "io_error", "led0 alias is not available");
	}
	if (!be_isbool(vm, 1) && !be_isint(vm, 1)) {
		be_raise(vm, "type_error", "led(value) expects bool or int");
	}

	gpio_pin_set_dt(&led, be_tobool(vm, 1));
	be_return_nil(vm);
}

static int native_button(bvm *vm)
{
	int value;

	if (button.port == NULL || !device_is_ready(button.port)) {
		be_raise(vm, "io_error", "sw0 alias is not available");
	}

	value = gpio_pin_get_dt(&button);
	if (value < 0) {
		be_raise(vm, "io_error", "cannot read sw0");
	}
	be_pushbool(vm, value != 0);
	be_return(vm);
}

int bb_repl_init(void)
{
	if (led.port != NULL && device_is_ready(led.port)) {
		(void)gpio_pin_configure_dt(&led, GPIO_OUTPUT_INACTIVE);
	}
	if (button.port != NULL && device_is_ready(button.port)) {
		(void)gpio_pin_configure_dt(&button, GPIO_INPUT);
	}

	repl_vm = be_vm_new();
	if (repl_vm == NULL) {
		return -ENOMEM;
	}

	be_regfunc(repl_vm, "millis", native_millis);
	be_regfunc(repl_vm, "led", native_led);
	be_regfunc(repl_vm, "button", native_button);
	return 0;
}

int bb_repl_eval(const char *source, size_t length)
{
	char expression[CONFIG_BLOCKBERRY_REPL_LINE_SIZE + 16];
	int result;
	bool try_expression;

	if (repl_vm == NULL || source == NULL || length == 0) {
		return -EINVAL;
	}
	if (length >= CONFIG_BLOCKBERRY_REPL_SCRIPT_SIZE) {
		return -EMSGSIZE;
	}

	try_expression = length < CONFIG_BLOCKBERRY_REPL_LINE_SIZE &&
			 memchr(source, '\n', length) == NULL;
	if (try_expression) {
		snprintf(expression, sizeof(expression), "return (%.*s)",
			 (int)length, source);
		result = be_loadbuffer(repl_vm, "repl", expression,
				       strlen(expression));

		if (be_getexcept(repl_vm, result) == BE_SYNTAX_ERROR) {
			be_pop(repl_vm, 2);
			result = be_loadbuffer(repl_vm, "repl", source, length);
		}
	} else {
		result = be_loadbuffer(repl_vm, "script", source, length);
	}

	if (result != BE_OK) {
		be_dumpexcept(repl_vm);
		be_pop(repl_vm, 2);
		return -EINVAL;
	}

	result = be_pcall(repl_vm, 0);
	if (result == BE_OK) {
		if (!be_isnil(repl_vm, -1)) {
			be_dumpvalue(repl_vm, -1);
			be_writenewline();
		}
		be_pop(repl_vm, 1);
		return 0;
	}

	if (result == BE_EXCEPTION) {
		be_dumpexcept(repl_vm);
		be_pop(repl_vm, 1);
		return -EFAULT;
	}

	return result == BE_MALLOC_FAIL ? -ENOMEM : -EIO;
}

bvm *bb_repl_vm(void)
{
	return repl_vm;
}
