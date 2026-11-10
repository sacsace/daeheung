import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders login screen', () => {
  render(<App />);
  const submitButton = screen.getByRole('button', { name: /sign in/i });
  expect(submitButton).toBeInTheDocument();
});
