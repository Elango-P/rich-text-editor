import React from 'react';

const LabelComponent = ({ children }) => {
    if (!children) return null;
    return (
        <label className="block text-sm font-medium text-gray-700 mb-1">
            {children}
        </label>
    );
};

export default LabelComponent;
