// MVS Frontend Unit Test Example
// daeheung-rt-one-web/src/components/__tests__/LoginForm.test.tsx

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../../theme';
import Login from '../../pages/Auth/Login';

jest.mock('../../services/api', () => ({
  api: { post: jest.fn() },
  API_BASE_URL: 'http://localhost:3500/api',
  getApiBaseUrl: jest.fn(() => 'http://localhost:3500/api')
}));

jest.mock('../../store', () => ({
  useStore: () => ({
    login: jest.fn()
  })
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => jest.fn()
}));

const MockedLogin = () => (
  <BrowserRouter>
    <ThemeProvider theme={theme}>
      <Login />
    </ThemeProvider>
  </BrowserRouter>
);

describe('Login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Login form renders correctly', () => {
    render(<MockedLogin />);
    
    expect(screen.getByLabelText('login.userID')).toBeInTheDocument();
    expect(screen.getByLabelText('login.password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'login.loginButton' })).toBeInTheDocument();
  });

  test('User input is handled correctly', () => {
    render(<MockedLogin />);
    
    const useridInput = screen.getByLabelText('login.userID');
    const passwordInput = screen.getByLabelText('login.password');
    
    fireEvent.change(useridInput, { target: { value: 'admin' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    
    expect(useridInput).toHaveValue('admin');
    expect(passwordInput).toHaveValue('password123');
  });

  test('Login attempt triggers API call', async () => {
    const mockApi = require('../../services/api').api;
    mockApi.post.mockResolvedValue({
      data: {
        success: true,
        data: {
          token: 'mock-token',
          user: { userid: 'admin', name: 'Administrator' }
        }
      }
    });

    render(<MockedLogin />);
    
    const useridInput = screen.getByLabelText('login.userID');
    const passwordInput = screen.getByLabelText('login.password');
    const submitButton = screen.getByRole('button', { name: 'login.loginButton' });
    
    fireEvent.change(useridInput, { target: { value: 'admin' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/auth/login', {
        userid: 'admin',
        password: 'password123',
        remember: false
      });
    });
  });

  test('Password visibility toggle functionality', () => {
    render(<MockedLogin />);
    
    const passwordInput = screen.getByLabelText('login.password');
    const toggleButton = screen.getByRole('button', { name: 'login.showPassword' });
    
    // Password is hidden by default
    expect(passwordInput).toHaveAttribute('type', 'password');
    
    // Click toggle button
    fireEvent.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'text');
    
    // Click toggle button again
    fireEvent.click(screen.getByRole('button', { name: 'login.hidePassword' }));
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('Loading state display', async () => {
    const mockApi = require('../../services/api').api;
    mockApi.post.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

    render(<MockedLogin />);
    
    const useridInput = screen.getByLabelText('login.userID');
    const passwordInput = screen.getByLabelText('login.password');
    const submitButton = screen.getByRole('button', { name: 'login.loginButton' });
    
    fireEvent.change(useridInput, { target: { value: 'admin' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(submitButton);
    
    expect(screen.getByText('common.loading')).toBeInTheDocument();
    expect(submitButton).toBeDisabled();
  });
});
