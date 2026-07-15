#include "berry.h"
#include "be_sys.h"
#include "repl_transport.h"

#include <errno.h>
#include <stddef.h>

void be_writebuffer(const char *buffer, size_t length)
{
	bb_transport_write(buffer, length);
}

char *be_readstring(char *buffer, size_t size)
{
	(void)buffer;
	(void)size;
	return NULL;
}

void *be_fopen(const char *filename, const char *modes)
{
	(void)filename;
	(void)modes;
	return NULL;
}

int be_fclose(void *file)
{
	(void)file;
	return -ENOTSUP;
}

size_t be_fwrite(void *file, const void *buffer, size_t length)
{
	(void)file;
	bb_transport_write(buffer, length);
	return length;
}

size_t be_fread(void *file, void *buffer, size_t length)
{
	(void)file;
	(void)buffer;
	(void)length;
	return 0;
}

char *be_fgets(void *file, void *buffer, int size)
{
	(void)file;
	(void)buffer;
	(void)size;
	return NULL;
}

int be_fseek(void *file, long offset)
{
	(void)file;
	(void)offset;
	return -ENOTSUP;
}

long be_ftell(void *file)
{
	(void)file;
	return -1;
}

long be_fflush(void *file)
{
	(void)file;
	return 0;
}

size_t be_fsize(void *file)
{
	(void)file;
	return 0;
}

int be_isdir(const char *path)
{
	(void)path;
	return 0;
}

int be_isfile(const char *path)
{
	(void)path;
	return 0;
}

int be_isexist(const char *path)
{
	(void)path;
	return 0;
}

char *be_getcwd(char *buffer, size_t size)
{
	(void)buffer;
	(void)size;
	return NULL;
}

int be_chdir(const char *path)
{
	(void)path;
	return -ENOTSUP;
}

int be_mkdir(const char *path)
{
	(void)path;
	return -ENOTSUP;
}

int be_unlink(const char *path)
{
	(void)path;
	return -ENOTSUP;
}

int be_dirfirst(bdirinfo *info, const char *path)
{
	(void)info;
	(void)path;
	return -ENOTSUP;
}

int be_dirnext(bdirinfo *info)
{
	(void)info;
	return 1;
}

int be_dirclose(bdirinfo *info)
{
	(void)info;
	return -ENOTSUP;
}
