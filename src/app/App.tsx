import React from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { TreeProvider } from './context/TreeContext';
import { Toaster } from 'sonner';

function App() {
  return (
    <TreeProvider>
      <RouterProvider router={router} />
      <Toaster richColors position="bottom-right" />
    </TreeProvider>
  );
}

export default App;
