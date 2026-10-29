import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MyUploads from './MyUploads';
import { saveUploadReceipt, UPLOAD_RECEIPTS_KEY } from '../lib/uploadReceipts';
import { authErrorMessage } from '../lib/authErrors';
afterEach(()=>{cleanup();localStorage.clear();vi.restoreAllMocks();});
it('finds a completed upload again after returning to the page without an account',()=>{
 saveUploadReceipt(241,'Guest mix');
 render(<MemoryRouter><MyUploads/></MemoryRouter>);
 expect(screen.getByRole('link',{name:'Guest mix — Open mix'})).toHaveAttribute('href','/track/241');
 expect(screen.getByText(/browser only/)).toBeTruthy();
});
it('saves an older same-site link and rejects links outside this site',()=>{
 render(<MemoryRouter><MyUploads/></MemoryRouter>);
 fireEvent.change(screen.getByLabelText('Mix link'),{target:{value:'https://example.com/track/241'}});
 fireEvent.submit(screen.getByRole('button',{name:'Save mix link'}).closest('form')!);
 expect(screen.getByRole('alert')).toHaveTextContent('Paste a mix link');
 expect(localStorage.getItem(UPLOAD_RECEIPTS_KEY)).toBeNull();
 fireEvent.change(screen.getByLabelText('Mix link'),{target:{value:window.location.origin+'/track/241'}});
 fireEvent.submit(screen.getByRole('button',{name:'Save mix link'}).closest('form')!);
 expect(screen.getByRole('link',{name:'Saved mix 241 — Open mix'})).toHaveAttribute('href','/track/241');
});
it('gives a truthful fallback when browser storage is blocked',()=>{
 vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('blocked');});
 expect(saveUploadReceipt(241,'Guest mix')).toBe(false);
});
it('shows validation field messages without echoing submitted secrets',()=>{
 expect(authErrorMessage([{loc:['body','password'],msg:'Value error, password must contain at least one letter and one number',input:'secret123'}])).toBe('Password: password must contain at least one letter and one number');
});
