import { preventIosFocusZoom } from './ios-viewport.util';

describe('preventIosFocusZoom', () => {
  function createDocument(content?: string): Document {
    const doc = document.implementation.createHTMLDocument('');
    if (content !== undefined) {
      const meta = doc.createElement('meta');
      meta.name = 'viewport';
      meta.content = content;
      doc.head.appendChild(meta);
    }
    return doc;
  }

  function viewportOf(doc: Document): string | undefined {
    return doc.querySelector<HTMLMetaElement>('meta[name="viewport"]')?.content;
  }

  it('adds maximum-scale=1 to the viewport, keeping what it had', () => {
    const doc = createDocument('width=device-width, initial-scale=1.0');

    preventIosFocusZoom(doc);

    expect(viewportOf(doc)).toBe('width=device-width, initial-scale=1.0, maximum-scale=1');
  });

  it('does not add it twice', () => {
    const doc = createDocument('width=device-width, maximum-scale=1');

    preventIosFocusZoom(doc);
    preventIosFocusZoom(doc);

    expect(viewportOf(doc)).toBe('width=device-width, maximum-scale=1');
  });

  it('does nothing without a viewport tag', () => {
    const doc = createDocument();

    preventIosFocusZoom(doc);

    expect(viewportOf(doc)).toBeUndefined();
  });
});
