import { it, expect } from 'vitest';
import { uploadEndpoint, uploadFailureMessage } from './uploadTransport';
it('keeps the existing route by default and restricts the optional intake destination',()=>{
 expect(uploadEndpoint('')).toMatch(/\/upload$/);
 expect(uploadEndpoint('https://audio.djpapzin.com/intake/upload')).toBe('https://audio.djpapzin.com/intake/upload');
 for(const url of ['http://audio.djpapzin.com/intake/upload','https://evil.example/upload','https://audio.djpapzin.com/admin']) expect(()=>uploadEndpoint(url)).toThrow();
});
it('never displays a blank upload error, including FastAPI strings and proxy responses',()=>{
 expect(uploadFailureMessage(400,{detail:'There was an error parsing the body'})).toContain('parsing the body');
 expect(uploadFailureMessage(422,{detail:{error:'Choose a valid audio file'}})).toBe('Choose a valid audio file');
 expect(uploadFailureMessage(524,null)).toContain('timed out');
 expect(uploadFailureMessage(413,null)).toContain('file size');
 expect(uploadFailureMessage(400,null)).toContain('could not read');
 expect(uploadFailureMessage(500,null)).toContain('HTTP 500');
});
