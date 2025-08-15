import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from './Sidebar';

// Mock the navigation function
const mockNavigate = vi.fn();

// Helper to render Sidebar with router context
const renderSidebar = (initialEntries: string[] = ['/'], onNavigate = mockNavigate) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Sidebar onNavigate={onNavigate} />
    </MemoryRouter>
  );
};

describe('Sidebar Logo Navigation', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('renders logo with correct aria-label and text', () => {
    renderSidebar();
    
    const logo = screen.getByLabelText('Go to Home');
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveTextContent('Papzin & Crew');
  });

  it('logo links to home page (/)', () => {
    renderSidebar();
    
    const logo = screen.getByLabelText('Go to Home');
    expect(logo).toHaveAttribute('href', '/');
  });

  it('calls onNavigate when logo is clicked', async () => {
    const user = userEvent.setup();
    renderSidebar();
    
    const logo = screen.getByLabelText('Go to Home');
    await user.click(logo);
    
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('logo is keyboard accessible', async () => {
    const user = userEvent.setup();
    renderSidebar();
    
    const logo = screen.getByLabelText('Go to Home');
    
    // Focus the logo
    logo.focus();
    expect(logo).toHaveFocus();
    
    // Press Enter
    await user.keyboard('{Enter}');
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('logo contains music icon and gradient text', () => {
    renderSidebar();
    
    const logo = screen.getByLabelText('Go to Home');
    
    // Check for music icon (svg element)
    const musicIcon = logo.querySelector('svg');
    expect(musicIcon).toBeInTheDocument();
    
    // Check for gradient text span
    const gradientText = logo.querySelector('span');
    expect(gradientText).toBeInTheDocument();
    expect(gradientText).toHaveTextContent('Papzin & Crew');
    expect(gradientText).toHaveClass('bg-gradient-to-r', 'from-purple-400', 'to-pink-400');
  });

  it('logo works from different routes', () => {
    // Test from upload page
    renderSidebar(['/upload']);
    
    const logo = screen.getByLabelText('Go to Home');
    expect(logo).toHaveAttribute('href', '/');
  });
});
