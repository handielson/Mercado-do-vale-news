import React, { useLayoutEffect, useRef } from 'react';

// Caixa de texto que cresce com o conteúdo: sem barra de rolagem interna e sem precisar arrastar o canto.
// Começa com `minRows` linhas e cresce até caber tudo.
type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { minRows?: number };

export function AutoTextarea({ minRows = 2, style, onInput, ...props }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fit = () => {
    const element = ref.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight + 2}px`;
  };
  useLayoutEffect(fit, [props.value]);
  useLayoutEffect(() => {
    // Recalcula quando a largura muda (girar o celular, abrir/fechar painel).
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    let width = element.clientWidth;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth !== width) { width = element.clientWidth; fit(); }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <textarea
      ref={ref}
      rows={minRows}
      {...props}
      onInput={event => { fit(); onInput?.(event); }}
      style={{ overflow: 'hidden', resize: 'none', ...style }}
    />
  );
}
