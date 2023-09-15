import pytest
from dataclasses import field, dataclass, FrozenInstanceError

from neo4japp.utils.dataclass import *

descriptors = [
    (Descriptor, (), dict()),
    (LazyDefaulDescriptor, (lambda _, __: "foo",), dict()),
    (TemplateDescriptor, ("foo",), dict()),
    (CauseDefaultingDescriptor, (), dict()),
]


@pytest.mark.parametrize("descriptor, descriptor_args, descriptor_kwargs", descriptors)
def test_can_create_descriptor(
    descriptor: type(Descriptor), descriptor_args: tuple, descriptor_kwargs: dict
):
    class TestClass:
        test = descriptor(*descriptor_args, **descriptor_kwargs)

    TestClass()


@pytest.mark.parametrize("descriptor, descriptor_args, descriptor_kwargs", descriptors)
def test_can_create_frozen_dataclass_with_descriptor(
    descriptor: type(Descriptor), descriptor_args: tuple, descriptor_kwargs: dict
):
    @dataclass(frozen=True)
    class TestClass:
        test: str = descriptor(*descriptor_args, **descriptor_kwargs)
        test_default: str = field(
            default=descriptor(*descriptor_args, **descriptor_kwargs)
        )

    assert TestClass('') == TestClass('')


def test_lazy_default_descriptor_does_not_call_default_factory_on_init():
    def default_factory(_, __):
        raise Exception("Should not be called")

    class TestClass:
        test = LazyDefaulDescriptor(default_factory=default_factory)

    TestClass()


def test_lazy_default_descriptor_does_not_call_default_factory_on_dataclass_init():
    def default_factory(_, __):
        raise Exception("Should not be called")

    @dataclass
    class TestClass:
        test: str = LazyDefaulDescriptor(default_factory=default_factory)

    TestClass(test="foo")


def test_lazy_default_descriptor_calls_default_factory_on_access():
    class TestClass:
        test = LazyDefaulDescriptor(default_factory=lambda _, __: "foo")

    assert TestClass().test == "foo"


def test_lazy_default_descriptor_calls_default_factory_only_once():
    values = ["foo", "bar"]

    class TestClass:
        test = LazyDefaulDescriptor(default_factory=lambda _, __: values.pop(0))

    test = TestClass()
    assert test.test == test.test


def test_lazy_default_descriptor_returns_set_value():
    class TestClass:
        test = LazyDefaulDescriptor(default_factory=lambda _, __: "foo")

    instance = TestClass()
    instance.test = "bar"
    assert instance.test == "bar"


def test_lazy_default_descriptor_sets_value_in_init():
    @dataclass
    class TestClass:
        test: str = LazyDefaulDescriptor(default_factory=lambda _, __: "foo")

    assert TestClass(test="bar").test == "bar"


def test_lazy_default_descriptor_can_be_ussed_with_dataclass_field():
    @dataclass
    class TestClass:
        test: str = field(
            default=LazyDefaulDescriptor(default_factory=lambda _, __: "foo")
        )

    assert TestClass().test == "foo"
    assert TestClass(test="bar").test == "bar"


def test_frozen_lazy_default_descriptor_can_be_ussed_with_dataclass_field():
    @dataclass(frozen=True)
    class TestClass:
        test: str = field(
            default=LazyDefaulDescriptor(default_factory=lambda _, __: "foo")
        )

    assert TestClass().test == "foo"
    assert TestClass(test="bar").test == "bar"


def test_frozen_lazy_default_descriptor_sets_value_in_init():
    @dataclass(frozen=True)
    class TestClass:
        test: str = LazyDefaulDescriptor(default_factory=lambda _, __: "foo")

    assert TestClass(test="bar").test == "bar"


def test_frozen_lazy_default_descriptor_does_not_update_value_once_read():
    values = ["foo", "bar"]

    @dataclass(frozen=True)
    class TestClass:
        test = LazyDefaulDescriptor(default_factory=lambda _, __: values.pop(0))

    instance = TestClass()
    assert instance.test == "foo"  # freezes value
    assert instance.test == instance.test  # returns always the same value
    with pytest.raises(FrozenInstanceError):
        # noinspection PyDataclass
        instance.test = "bar"  # raises error
    assert instance.test == "foo"  # still returns the same value


def test_frozen_lazy_default_descriptor_does_not_update_value_once_init():
    @dataclass(frozen=True)
    class TestClass:
        test: str = LazyDefaulDescriptor(default_factory=lambda _, __: "")

    instance = TestClass(test="foo")
    assert instance.test == "foo"  # freezes value
    assert instance.test == instance.test  # returns always the same value
    with pytest.raises(FrozenInstanceError):
        # noinspection PyDataclass
        instance.test = "bar"  # raises error
    assert instance.test == "foo"  # still returns the same value


def test_template_descriptor_renders_template():
    class TestClass:
        foo: str = "bar"
        test: str = TemplateDescriptor("foo $foo")

    assert TestClass().test == "foo bar"


def test_template_descriptor_throws_for_missing_property():
    class TestClass:
        test: str = TemplateDescriptor("foo $foo")

    with pytest.raises(AttributeError):
        # noinspection PyUnusedLocal
        value = TestClass().test


def test_template_descriptor_throws_for_circular_property():
    class TestClass:
        foo: str = TemplateDescriptor("foo $bar")
        bar: str = TemplateDescriptor("$foo bar")

    with pytest.raises(RecursionError):
        # noinspection PyUnusedLocal
        value = TestClass().foo


def test_cause_defaulting_descriptor_returns_default_if_no_cause():
    class TestClass:
        test: str = CauseDefaultingDescriptor("foo")

    assert TestClass().test == "foo"


def test_cause_defaulting_descriptor_returns_cause_value():
    class TestClass:
        __cause__: Any = None
        test: str = CauseDefaultingDescriptor("foo")

        def __init__(self, __cause__=None, test=None):
            if test is not None:
                self.test = test
            if __cause__ is not None:
                self.__cause__ = __cause__

    assert TestClass().test == "foo"

    instance = TestClass(
        __cause__=TestClass(test="bar"),
    )
    assert instance.test == "bar"


def test_cause_defaulting_descriptor_returns_cause_value_dataclass():
    @dataclass
    class TestClass:
        __cause__: Any = None
        test: str = CauseDefaultingDescriptor("foo")

    assert TestClass().test == "foo"

    assert TestClass(__cause__=TestClass(test="bar")).test == "bar"


def test_cause_defaulting_descriptor_returns_cause_value_set_by_from_syntax():
    @dataclass
    class TestClass(Exception):
        abc: str = CauseDefaultingDescriptor("foo")

    assert TestClass().abc == "foo"

    try:
        try:
            raise TestClass(abc="bar")
        except TestClass as e:
            raise TestClass() from e
    except TestClass as e:
        assert e.abc == "bar"


def test_cause_defaulting_descriptor_throws_on_cause_value_type_missmatch():
    @dataclass
    class TestClassA(Exception):
        abc: str = CauseDefaultingDescriptor("foo")

    @dataclass
    class TestClassB(Exception):
        abc: int = CauseDefaultingDescriptor(123)

    assert TestClassA().abc == "foo"
    assert TestClassB().abc == 123

    try:
        try:
            raise TestClassA()
        except TestClassA as e:
            raise TestClassB() from e
    except TestClassB as e:
        assert e.abc == "foo"
