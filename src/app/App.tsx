import React from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { TreeProvider } from './context/TreeContext';

function App() {
  return (
    <TreeProvider>
      <RouterProvider router={router} />
    </TreeProvider>
  );
}

export default App;
