// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { createElement, replaceContent } from './dom';

describe('safe DOM helpers', () => {
    it('renders user-controlled strings as text instead of markup', () => {
        const payload = '<img src=x onerror="alert(1)"><script>bad()</script>';
        const element = createElement('p', { text: payload });

        expect(element.textContent).toBe(payload);
        expect(element.querySelector('img')).toBeNull();
        expect(element.querySelector('script')).toBeNull();
    });

    it('replaces existing content without parsing HTML', () => {
        const parent = document.createElement('div');
        parent.append(document.createElement('span'));
        const text = document.createTextNode('<strong>plain</strong>');

        replaceContent(parent, text);

        expect(parent.childNodes).toHaveLength(1);
        expect(parent.textContent).toBe('<strong>plain</strong>');
        expect(parent.querySelector('strong')).toBeNull();
    });
});
