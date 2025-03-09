import React from 'react';
import { Loader2 } from 'lucide-react';

const LoadingSpinner = () => (
    <div className="flex items-center justify-center">
        <Loader2 className="animate-spin h-5 w-5" />
    </div>
);

export default LoadingSpinner;