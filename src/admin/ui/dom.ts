export function createElement<K extends keyof HTMLElementTagNameMap>(
    tagName: K,
    options: {
        className?: string;
        text?: string;
        attributes?: Record<string, string>;
    } = {}
): HTMLElementTagNameMap[K] {
    const element = document.createElement(tagName);
    if (options.className) element.className = options.className;
    if (options.text !== undefined) element.textContent = options.text;
    for (const [name, value] of Object.entries(options.attributes ?? {})) {
        element.setAttribute(name, value);
    }
    return element;
}

export function replaceContent(parent: Element, ...children: Node[]): void {
    parent.replaceChildren(...children);
}
