import { cleanup, render, screen, act } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import DeferredImage from './DeferredImage';
import { DEFAULT_ARTWORK_URL } from '../lib/artwork';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('does not request offscreen art before it enters the viewport',()=>{
 let notify!:(entries:{isIntersecting:boolean}[])=>void;
 const disconnect=vi.fn();vi.stubGlobal('IntersectionObserver',class{constructor(callback:typeof notify){notify=callback;}observe(){}disconnect=disconnect;});
 render(<DeferredImage src="https://example.invalid/large-cover.jpg" alt="Mix cover"/>);
 const img=screen.getByAltText('Mix cover');expect(img.getAttribute('src')).toBe(DEFAULT_ARTWORK_URL);
 act(()=>notify([{isIntersecting:false}]));expect(img.getAttribute('src')).toBe(DEFAULT_ARTWORK_URL);
 act(()=>notify([{isIntersecting:true}]));expect(img.getAttribute('src')).toBe('https://example.invalid/large-cover.jpg');expect(disconnect).toHaveBeenCalled();
});
