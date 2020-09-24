class StatefulViewMixin:
    def dispatch_request(self, *args, **kwargs):
        self.args = args
        self.kwargs = kwargs
        return super().dispatch_request()
