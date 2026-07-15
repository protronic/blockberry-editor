#ifndef BLOCKBERRY_BERRY_CONF_H
#define BLOCKBERRY_BERRY_CONF_H

#include <assert.h>

#define BE_DEBUG                         0
#define BE_INTGER_TYPE                   2
#define BE_USE_SINGLE_FLOAT              1
#define BE_USE_PRECOMPILED_OBJECT        1
#define BE_DEBUG_RUNTIME_INFO            1
#define BE_DEBUG_VAR_INFO                0
#define BE_USE_PERF_COUNTERS             0
#define BE_VM_OBSERVABILITY_SAMPLING     16
#define BE_STACK_TOTAL_MAX               512
#define BE_STACK_FREE_MIN                8
#define BE_STACK_START                   32
#define BE_CONST_SEARCH_SIZE             24
#define BE_USE_STR_HASH_CACHE            0

#define BE_USE_FILE_SYSTEM               0
#define BE_USE_SCRIPT_COMPILER           1
#define BE_USE_BYTECODE_SAVER            0
#define BE_USE_BYTECODE_LOADER           0
#define BE_USE_SHARED_LIB                0
#define BE_USE_OVERLOAD_HASH             0
#define BE_USE_DEBUG_HOOK                0
#define BE_USE_DEBUG_GC                  0
#define BE_USE_DEBUG_STACK               0

#define BE_USE_STRING_MODULE             1
#define BE_USE_JSON_MODULE               1
#define BE_USE_MATH_MODULE               1
#define BE_USE_TIME_MODULE               0
#define BE_USE_OS_MODULE                 0
#define BE_USE_GLOBAL_MODULE             1
#define BE_USE_SYS_MODULE                0
#define BE_USE_DEBUG_MODULE              0
#define BE_USE_GC_MODULE                 1
#define BE_USE_SOLIDIFY_MODULE           0
#define BE_USE_INTROSPECT_MODULE         0
#define BE_USE_STRICT_MODULE             0

#define be_assert(expr)                  assert(expr)

#endif
