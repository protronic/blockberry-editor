#ifndef BLOCKBERRY_BERRY_REPL_H
#define BLOCKBERRY_BERRY_REPL_H

#include <stddef.h>

struct bvm;

int bb_repl_init(void);
int bb_repl_eval(const char *source, size_t length);
struct bvm *bb_repl_vm(void);

#endif
