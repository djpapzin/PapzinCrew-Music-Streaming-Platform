import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import FeedbackInbox from './FeedbackInbox';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const report={id:'a',message:'Please improve searching',name:'',page:'/search',device:'mobile',created_at:'2026-10-29T10:00:00Z',category:'improvement',status:'new'};
it('loads privately when unlocked and lets the owner filter and mark done',async()=>{
 const fetch=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({reports:[report]})}).mockResolvedValueOnce({ok:true,json:async()=>({report:{...report,status:'done'}})});
 vi.stubGlobal('fetch',fetch);render(<FeedbackInbox adminKey="" ownerSession/>);
 await screen.findByText(report.message);
 fireEvent.change(screen.getByLabelText('Feedback status'),{target:{value:'new'}});
 fireEvent.click(screen.getByRole('button',{name:'Mark done'}));
 await screen.findByText('No feedback matches these filters.');
 expect(fetch.mock.calls[1][1].method).toBe('PATCH');
 expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({status:'done'});
 fireEvent.change(screen.getByLabelText('Feedback status'),{target:{value:'done'}});
 expect(screen.getByText(report.message)).toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Feedback category'),{target:{value:'problem'}});
 expect(screen.queryByText(report.message)).not.toBeInTheDocument();
});
it('does not request or show private feedback before owner unlock',async()=>{
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);render(<FeedbackInbox adminKey=""/>);
 expect(screen.getByRole('button',{name:'Refresh feedback'})).toBeDisabled();
 expect(fetch).not.toHaveBeenCalled();
});
it('keeps the message available when saving its status fails',async()=>{
 const fetch=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({reports:[report]})}).mockResolvedValueOnce({ok:false});
 vi.stubGlobal('fetch',fetch);render(<FeedbackInbox adminKey="owner-test"/>);
 await screen.findByText(report.message);fireEvent.click(screen.getByRole('button',{name:'Mark reviewed'}));
 await screen.findByRole('alert');expect(screen.getByText(report.message)).toBeInTheDocument();
 await waitFor(()=>expect(screen.getByRole('button',{name:'Mark reviewed'})).toBeEnabled());
});
