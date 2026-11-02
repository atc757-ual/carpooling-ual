import { sanitizeLegalHtml } from './legal-html';

describe('sanitizeLegalHtml', () => {
  it('keeps the allowed content tags without attributes', () => {
    expect(
      sanitizeLegalHtml(
        '<h2 class="x">1. Uso</h2><p style="color:red">Texto <strong>importante</strong> y <em>matiz</em>.<br/></p><ul><li>Uno</li></ul><ol><li>Dos</li></ol>',
      ),
    ).toBe(
      '<h2>1. Uso</h2><p>Texto <strong>importante</strong> y <em>matiz</em>.<br></p><ul><li>Uno</li></ul><ol><li>Dos</li></ol>',
    );
  });

  it('keeps safe links and drops the rest of their attributes', () => {
    expect(
      sanitizeLegalHtml(
        '<a href="https://www.ual.es/privacidad" onclick="steal()" target="_blank">UAL</a> <a href=\'mailto:dpo@ual.es\'>DPO</a>',
      ),
    ).toBe(
      '<a href="https://www.ual.es/privacidad" rel="noopener noreferrer">UAL</a> <a href="mailto:dpo@ual.es" rel="noopener noreferrer">DPO</a>',
    );
  });

  it('drops unsafe links, scripts, styles, frames and comments', () => {
    const html = [
      '<a href="javascript:alert(1)">x</a>',
      '<a href="data:text/html;base64,AAA">y</a>',
      '<script>alert(1)</script>',
      '<style>p{display:none}</style>',
      '<iframe src="https://evil.example"></iframe>',
      '<!-- nota interna -->',
      '<img src=x onerror=alert(1)>',
      '<svg onload=alert(1)><circle/></svg>',
    ].join('');

    expect(sanitizeLegalHtml(html)).toBe('<a>x</a><a>y</a>');
  });

  it('escapes stray markup so it shows as text', () => {
    expect(sanitizeLegalHtml('<p>1 < 2 & "comillas" > 0</p>')).toBe(
      '<p>1 &lt; 2 &amp; &quot;comillas&quot; &gt; 0</p>',
    );
    expect(sanitizeLegalHtml('<p>Ya escapado: &amp; &#233;</p>')).toBe(
      '<p>Ya escapado: &amp; &#233;</p>',
    );
    expect(sanitizeLegalHtml('<scr<script>ipt>alert(1)</p>')).toBe('&lt;scr');
  });
});
