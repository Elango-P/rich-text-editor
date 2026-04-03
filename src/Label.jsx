import React from 'react';

const LabelComponent = ({ children }) => {
    if (!children) return null;
    return (
        <label className="rte-label" style={{ marginBottom: '4px', display: 'block' }}>
            {children}
        </label>
    );
};

export default LabelComponent;
