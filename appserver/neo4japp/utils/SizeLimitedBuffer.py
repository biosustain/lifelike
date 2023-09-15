import io


class SizeLimitedBuffer(io.BytesIO):
    def __init__(self, max_size, *args, **kwargs):
        self.max_size = max_size
        super().__init__(*args, **kwargs)

    def write(self, b):
        if self.tell() + len(b) > self.max_size:
            raise OverflowError()
        return super().write(b)


__all__ = ['SizeLimitedBuffer']
