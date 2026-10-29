import { it, expect } from 'vitest';
import { prepareCover, MAX_COVER_BYTES } from './coverUpload';
it('rejects non-image, empty and oversized cover files before decoding', async () => {
 await expect(prepareCover(new File(['<svg/>'],'cover.svg',{type:'image/svg+xml'}))).rejects.toThrow('JPEG, PNG or WebP');
 await expect(prepareCover(new File([],'empty.jpg',{type:'image/jpeg'}))).rejects.toThrow('smaller than 5 MB');
 const file=new File(['x'],'huge.jpg',{type:'image/jpeg'});Object.defineProperty(file,'size',{value:MAX_COVER_BYTES+1});
 await expect(prepareCover(file)).rejects.toThrow('smaller than 5 MB');
});
