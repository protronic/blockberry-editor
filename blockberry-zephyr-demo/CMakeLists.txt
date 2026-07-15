cmake_minimum_required(VERSION 3.20.0)

find_package(Zephyr REQUIRED HINTS $ENV{ZEPHYR_BASE})
project(blockberry_zephyr_demo C)

find_package(Python3 REQUIRED COMPONENTS Interpreter)

set(BERRY_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../modules/lib/berry"
    CACHE PATH "Path to the Berry interpreter source")
if(NOT EXISTS "${BERRY_DIR}/src/berry.h")
  message(FATAL_ERROR
    "Berry source missing at ${BERRY_DIR}. Run 'west update' from the workspace root.")
endif()

file(GLOB BERRY_CORE_SOURCES CONFIGURE_DEPENDS "${BERRY_DIR}/src/*.c")
set(BERRY_GENERATED_HEADER "${BERRY_DIR}/generate/be_const_strtab.h")

add_custom_command(
  OUTPUT "${BERRY_GENERATED_HEADER}"
  COMMAND "${CMAKE_COMMAND}" -E make_directory "${BERRY_DIR}/generate"
  COMMAND
    "${Python3_EXECUTABLE}" "${BERRY_DIR}/tools/coc/coc"
    -o "${BERRY_DIR}/generate"
    "${BERRY_DIR}/src" "${BERRY_DIR}/default"
    -c "${CMAKE_CURRENT_SOURCE_DIR}/include/berry_conf.h"
  DEPENDS
    ${BERRY_CORE_SOURCES}
    "${BERRY_DIR}/default/be_modtab.c"
    "${CMAKE_CURRENT_SOURCE_DIR}/include/berry_conf.h"
  COMMENT "Generating Berry constant string table"
  VERBATIM
)

add_custom_target(berry_generated DEPENDS "${BERRY_GENERATED_HEADER}")
add_dependencies(app berry_generated)

target_sources(app PRIVATE
  src/main.c
  src/berry_repl.c
  src/berry_port.c
  src/repl_transport.c
  "${BERRY_DIR}/default/be_modtab.c"
  ${BERRY_CORE_SOURCES}
)

if(CONFIG_BT)
  target_sources(app PRIVATE src/ble_nus.c)
endif()

target_include_directories(app PRIVATE
  include
  "${BERRY_DIR}/src"
  "${BERRY_DIR}/default"
  "${BERRY_DIR}/generate"
)

target_compile_options(app PRIVATE
  -Wno-unused-parameter
  -Wno-missing-field-initializers
  -Wno-sign-compare
)

zephyr_link_libraries(m)
