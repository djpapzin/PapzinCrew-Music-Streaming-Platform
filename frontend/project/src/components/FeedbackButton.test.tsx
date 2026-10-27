import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import FeedbackButton from './FeedbackButton';
beforeEach(()=>{
  HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
  HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
  vi.stubGlobal('matchMedia',()=>({matches:true}));
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const open=()=>{render(<MemoryRouter initialEntries={['/track/237?secret=omit']}><FeedbackButton/></MemoryRouter>);fireEvent.click(screen.getByRole('button',{name:'Report a problem'}));};
it('sends only entered feedback and coarse context, with explicit success',async()=>{
  const fetch=vi.fn(async()=>({ok:true}));vi.stubGlobal('fetch',fetch);open();
  fireEvent.change(screen.getByLabelText('What happened?'),{target:{value:'Play did not start the mix'}});
  fireEvent.click(screen.getByText('Send feedback'));await screen.findByText(/feedback was sent privately/);
  const body=JSON.parse(fetch.mock.calls[0][1].body);
  expect(body.page).toBe('/track/237');expect(body.device).toBe('mobile');expect(body.message).toBe('Play did not start the mix');
  expect(body).not.toHaveProperty('userAgent');
});
it('keeps the message and same report ID after a failed connection',async()=>{
  const fetch=vi.fn().mockRejectedValueOnce(new Error('Connection failed')).mockResolvedValueOnce({ok:true});vi.stubGlobal('fetch',fetch);open();
  fireEvent.change(screen.getByLabelText('What happened?'),{target:{value:'The mix failed to start'}});fireEvent.click(screen.getByText('Send feedback'));
  await screen.findByRole('alert');expect((screen.getByLabelText('What happened?') as HTMLTextAreaElement).value).toBe('The mix failed to start');
  fireEvent.click(screen.getByText('Send feedback'));await screen.findByText(/feedback was sent privately/);
  expect(JSON.parse(fetch.mock.calls[0][1].body).id).toBe(JSON.parse(fetch.mock.calls[1][1].body).id);
});
