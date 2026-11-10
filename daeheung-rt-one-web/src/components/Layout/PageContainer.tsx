import React from 'react';
import { Box, Container } from '@mui/material';

interface PageContainerProps {
  children: React.ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | false;
  disableGutters?: boolean;
}

const PageContainer: React.FC<PageContainerProps> = ({ 
  children, 
  maxWidth = 'lg',
  disableGutters = false 
}) => {
  return (
    <Box
      sx={{
        width: '100%',
        minHeight: 'calc(100vh - 64px - 24px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        py: 2,
        background: 'transparent',
      }}
    >
      <Container 
        maxWidth={false}
        disableGutters={disableGutters}
        sx={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
        }}
      >
        {children}
      </Container>
    </Box>
  );
};

export default PageContainer;
