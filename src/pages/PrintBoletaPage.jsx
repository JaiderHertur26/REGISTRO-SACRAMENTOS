import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppData } from '@/context/AppDataContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer } from 'lucide-react';

const PrintBoletaPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data } = useAppData();
  const [baptism, setBaptism] = useState(null);

  useEffect(() => {
    const found = data.baptisms.find(b => b.id === id);
    setBaptism(found);
  }, [id, data.baptisms]);

  const handlePrint = () => {
    window.print();
  };

  if (!baptism) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Baptism record not found</p>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{'Print Baptism Receipt'}</title>
      </Helmet>

      <div className="min-h-screen bg-gray-100">
        {/* Print Controls - Hidden when printing */}
        <div className="no-print bg-white shadow-sm p-4 mb-4">
          <div className="max-w-4xl mx-auto flex justify-between items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/baptism/${id}`)}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <Button
              onClick={handlePrint}
              className="gap-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
            >
              <Printer className="w-4 h-4" />
              Print
            </Button>
          </div>
        </div>

        {/* Print Content - Letter Size (8.5" x 11") */}
        <div className="print-container max-w-4xl mx-auto bg-white p-8">
          {/* Parish Receipt Section */}
          <div className="receipt-section mb-8">
            <div className="border-2 border-gray-800 rounded-lg p-6">
              <div className="text-center mb-6 border-b-2 border-gray-300 pb-4">
                <h1 className="text-2xl font-bold text-gray-900 mb-1">{baptism.parish}</h1>
                <p className="text-sm text-gray-600">PARISH RECEIPT (For Archiving)</p>
              </div>

              <div className="grid grid-cols-2 gap-6 text-sm">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2 border-b border-gray-300 pb-1">Baptism Information</h3>
                  <p><span className="font-medium">Date:</span> {new Date(baptism.baptismDate).toLocaleDateString()}</p>
                  <p><span className="font-medium">Time:</span> {baptism.baptismTime || 'N/A'}</p>
                  <p><span className="font-medium">Minister:</span> {baptism.celebrantMinister}</p>
                  {baptism.status === 'seated' && (
                    <p className="mt-2 text-xs">
                      <span className="font-medium">Registry:</span> Book {baptism.bookNumber}, Folio {baptism.folioNumber}, No. {baptism.baptismNumber}
                    </p>
                  )}
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2 border-b border-gray-300 pb-1">Baptized Person</h3>
                  <p><span className="font-medium">Name:</span> {baptism.firstName} {baptism.lastName}</p>
                  <p><span className="font-medium">Sex:</span> {baptism.sex}</p>
                  <p><span className="font-medium">Birth Date:</span> {new Date(baptism.birthDate).toLocaleDateString()}</p>
                  <p><span className="font-medium">Birth Place:</span> {[baptism.birthCity, baptism.birthCountry].filter(Boolean).join(', ')}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2 border-b border-gray-300 pb-1">Parents</h3>
                  <p><span className="font-medium">Father:</span> {baptism.fatherName}</p>
                  <p><span className="font-medium">Mother:</span> {baptism.motherName}</p>
                  <p><span className="font-medium">Address:</span> {baptism.parentsAddress || 'N/A'}</p>
                  <p><span className="font-medium">Phone:</span> {baptism.parentsPhone || 'N/A'}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2 border-b border-gray-300 pb-1">Godparents</h3>
                  <p><span className="font-medium">Godfather:</span> {baptism.godfatherName || 'N/A'}</p>
                  <p><span className="font-medium">Godmother:</span> {baptism.godmotherName || 'N/A'}</p>
                  {baptism.observations && (
                    <p className="mt-2 text-xs"><span className="font-medium">Notes:</span> {baptism.observations}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Cut Line */}
          <div className="my-8 flex items-center justify-center">
            <div className="flex-1 border-t-2 border-dashed border-gray-400"></div>
            <span className="px-4 text-xs text-gray-500 font-medium">✂ CUT HERE ✂</span>
            <div className="flex-1 border-t-2 border-dashed border-gray-400"></div>
          </div>

          {/* Family Receipt Section */}
          <div className="receipt-section">
            <div className="border-2 border-gray-800 rounded-lg p-6">
              <div className="text-center mb-6 border-b-2 border-gray-300 pb-4">
                <h1 className="text-2xl font-bold text-gray-900 mb-1">{baptism.parish}</h1>
                <p className="text-sm text-gray-600">FAMILY RECEIPT (For Family)</p>
              </div>

              <div className="grid grid-cols-2 gap-6 text-sm">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2 border-b border-gray-300 pb-1">Baptism Information</h3>
                  <p><span className="font-medium">Date:</span> {new Date(baptism.baptismDate).toLocaleDateString()}</p>
                  <p><span className="font-medium">Time:</span> {baptism.baptismTime || 'N/A'}</p>
                  <p><span className="font-medium">Minister:</span> {baptism.celebrantMinister}</p>
                  {baptism.status === 'seated' && (
                    <p className="mt-2 text-xs">
                      <span className="font-medium">Registry:</span> Book {baptism.bookNumber}, Folio {baptism.folioNumber}, No. {baptism.baptismNumber}
                    </p>
                  )}
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2 border-b border-gray-300 pb-1">Baptized Person</h3>
                  <p><span className="font-medium">Name:</span> {baptism.firstName} {baptism.lastName}</p>
                  <p><span className="font-medium">Sex:</span> {baptism.sex}</p>
                  <p><span className="font-medium">Birth Date:</span> {new Date(baptism.birthDate).toLocaleDateString()}</p>
                  <p><span className="font-medium">Birth Place:</span> {[baptism.birthCity, baptism.birthCountry].filter(Boolean).join(', ')}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2 border-b border-gray-300 pb-1">Parents</h3>
                  <p><span className="font-medium">Father:</span> {baptism.fatherName}</p>
                  <p><span className="font-medium">Mother:</span> {baptism.motherName}</p>
                  <p><span className="font-medium">Address:</span> {baptism.parentsAddress || 'N/A'}</p>
                  <p><span className="font-medium">Phone:</span> {baptism.parentsPhone || 'N/A'}</p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2 border-b border-gray-300 pb-1">Godparents</h3>
                  <p><span className="font-medium">Godfather:</span> {baptism.godfatherName || 'N/A'}</p>
                  <p><span className="font-medium">Godmother:</span> {baptism.godmotherName || 'N/A'}</p>
                  {baptism.observations && (
                    <p className="mt-2 text-xs"><span className="font-medium">Notes:</span> {baptism.observations}</p>
                  )}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-300 text-center text-xs text-gray-600">
                <p>This receipt certifies the baptism was registered in our parish records.</p>
                <p className="mt-1">Issued on: {new Date().toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          
          .print-container {
            max-width: 100% !important;
            padding: 0.5in !important;
          }
          
          body {
            background: white !important;
          }
          
          @page {
            size: letter;
            margin: 0.5in;
          }
        }
      `}</style>
    </>
  );
};

export default PrintBoletaPage;