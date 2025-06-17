import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const Dashboard: React.FC = () => {
  const { profile } = useAuth();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">
        Welcome, {profile?.full_name || 'User'}!
      </h1>
      <p className="text-gray-600">This is your dashboard.</p>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-2">Quick Overview</h2>
        <ul className="list-disc list-inside text-gray-700 space-y-1">
          <li>View your appointments</li>
          <li>Check notifications</li>
          {profile?.role === 'staff' && (
            <>
              <li>Set your availability</li>
              <li>Generate reports</li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
};

export default Dashboard;
