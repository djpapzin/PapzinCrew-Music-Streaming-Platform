import React from 'react';

interface FallbackWarningProps {
  isVisible: boolean;
  onClose: () => void;
  onDeleteLocal: () => void;
  trackTitle?: string;
}

export const FallbackWarning: React.FC<FallbackWarningProps> = ({
  isVisible,
  onClose,
  onDeleteLocal,
  trackTitle = 'this track'
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed top-4 right-4 z-50 max-w-md bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md shadow-lg">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-yellow-800">
            Upload Saved Locally (B2 Failed)
          </h3>
          <div className="mt-2 text-sm text-yellow-700">
            <p>
              <strong>{trackTitle}</strong> was saved to local storage because Backblaze B2 upload failed or timed out.
            </p>
            <p className="mt-1">
              <strong>⚠️ Warning:</strong> If you delete the local file, the track will become unplayable and remain visible in the app until manually cleaned up.
            </p>
          </div>
          <div className="mt-4 flex space-x-2">
            <button
              onClick={onDeleteLocal}
              className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors"
            >
              Delete Local File & DB Entry
            </button>
            <button
              onClick={onClose}
              className="bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-400 transition-colors"
            >
              Keep Local File
            </button>
          </div>
        </div>
        <div className="ml-4 flex-shrink-0">
          <button
            onClick={onClose}
            className="inline-flex text-yellow-400 hover:text-yellow-600 focus:outline-none"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
