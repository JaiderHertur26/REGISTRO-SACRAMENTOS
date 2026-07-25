import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import UniversalBackupManager from '@/components/UniversalBackupManager';
import { Helmet } from 'react-helmet';

const BackupPage = () => {
  return (
    <DashboardLayout>
      <Helmet>
        <title>Copias de Seguridad - Eclesia Digital</title>
      </Helmet>
      <h1 className="text-2xl font-bold mb-6">Copias de Seguridad</h1>
      <div className="max-w-2xl">
        <UniversalBackupManager />
      </div>
    </DashboardLayout>
  );
};

export default BackupPage;