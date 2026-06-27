import React from 'react';

const Loader: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-50">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-primary mt-4 text-lg tracking-wider">Processing...</p>
    </div>
  );
};

export const FullScreenLoader: React.FC = () => {
    return (
        <div className="fixed inset-0 bg-background flex items-center justify-center">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
    );
}

export default Loader;