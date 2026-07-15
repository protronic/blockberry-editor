#ifndef BLOCKBERRY_REPL_TRANSPORT_H
#define BLOCKBERRY_REPL_TRANSPORT_H

#include <stddef.h>
#include <stdint.h>

int bb_transport_init(void);
int bb_transport_submit(const uint8_t *data, size_t length);
int bb_transport_receive(char *buffer, size_t capacity);
void bb_transport_write(const char *data, size_t length);
void bb_transport_prompt(void);

#if defined(CONFIG_BT)
int bb_ble_nus_init(void);
void bb_ble_nus_write(const uint8_t *data, size_t length);
#endif

#endif
