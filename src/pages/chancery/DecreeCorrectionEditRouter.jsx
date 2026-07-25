import React from 'react';
import { useSearchParams } from 'react-router-dom';
import ChanceryCorrectionDecreeListPage from '@/pages/chancery/ChanceryCorrectionDecreeListPage';
import EditDecreeCorrectionPage from '@/pages/chancery/decree-correction/EditDecreeCorrectionPage';

/**
 * Routes traffic for /chancery/decree-correction/edit based on the presence of an ID parameter.
 * - If ?id=123 is present -> Render the Editor
 * - If no ID -> Render the List to allow selection
 */
const DecreeCorrectionEditRouter = () => {
    const [searchParams] = useSearchParams();
    const id = searchParams.get('id');

    if (id) {
        return <EditDecreeCorrectionPage />;
    }

    return <ChanceryCorrectionDecreeListPage />;
};

export default DecreeCorrectionEditRouter;