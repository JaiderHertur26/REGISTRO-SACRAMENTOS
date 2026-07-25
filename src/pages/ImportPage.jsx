import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAppData } from '@/context/AppDataContext';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Upload, FileJson, CheckCircle } from 'lucide-react';

const ImportPage = () => {
  const navigate = useNavigate();
  const { importData, loadData } = useAppData();
  const { toast } = useToast();
  const [importing, setImporting] = useState(false);

  const dataTypes = [
    { key: 'dioceses', label: 'Dioceses/Archdioceses', filename: 'diocesis.json' },
    { key: 'vicariates', label: 'Vicariates', filename: 'vicariates.json' },
    { key: 'deaneries', label: 'Deaneries', filename: 'deaneries.json' },
    { key: 'parishes', label: 'Parishes', filename: 'iglesias.json' },
    { key: 'bishops', label: 'Bishops', filename: 'obispos.json' },
    { key: 'priests', label: 'Priests', filename: 'parrocos.json' },
    { key: 'baptisms', label: 'Baptisms', filename: 'bautizos.json' },
    { key: 'cities', label: 'Cities', filename: 'ciudades.json' },
    { key: 'users', label: 'Users', filename: 'misdatos.json' },
  ];

  const handleFileUpload = async (dataType, event) => {
    const file = event.target.files[0];
    if (!file) return;

    setImporting(true);

    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);

      if (!Array.isArray(jsonData)) {
        throw new Error('JSON data must be an array');
      }

      importData(dataType, jsonData);

      toast({
        title: "Import Successful",
        description: `${jsonData.length} ${dataType} imported successfully.`,
      });

      loadData();
    } catch (error) {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to parse JSON file",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  return (
    <>
      <Helmet>
        <title>{'Import Data'}</title>
        <meta name="description" content="Import JSON data files into the system" />
      </Helmet>

      <DashboardLayout>
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex items-center gap-4 mb-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/dashboard')}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Import Data</h1>
                <p className="text-gray-600 mt-1">Upload JSON files to populate the system</p>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">Import Instructions</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Upload JSON files with array format: [{"{"}"id": "1", ...{"}"}]</li>
                  <li>• Each data type has specific fields - ensure your JSON matches the structure</li>
                  <li>• Imported data will replace existing data of the same type</li>
                  <li>• Make sure IDs are unique and relationships are properly set</li>
                </ul>
              </div>

              <div className="space-y-4">
                {dataTypes.map((type) => (
                  <div
                    key={type.key}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-400 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileJson className="w-6 h-6 text-blue-600" />
                        <div>
                          <h3 className="font-semibold text-gray-900">{type.label}</h3>
                          <p className="text-sm text-gray-500">Expected: {type.filename}</p>
                        </div>
                      </div>
                      
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept=".json"
                          onChange={(e) => handleFileUpload(type.key, e)}
                          disabled={importing}
                          className="hidden"
                        />
                        <div className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                          <Upload className="w-4 h-4" />
                          <span className="text-sm">Upload JSON</span>
                        </div>
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">Sample JSON Structure</h3>
                <pre className="text-xs bg-gray-900 text-green-400 p-3 rounded overflow-x-auto">
{`[
  {
    "id": "1",
    "name": "Example Name",
    "relatedId": "1"
  },
  {
    "id": "2",
    "name": "Another Example",
    "relatedId": "1"
  }
]`}
                </pre>
              </div>
            </div>
          </motion.div>
        </div>
      </DashboardLayout>
    </>
  );
};

export default ImportPage;