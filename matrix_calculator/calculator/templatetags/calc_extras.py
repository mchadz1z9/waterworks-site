from django import template

register = template.Library()


@register.filter
def list_index(lst, i):
    """Return lst[i], or empty string if out of range."""
    try:
        return lst[i]
    except (IndexError, TypeError, KeyError):
        return ''
