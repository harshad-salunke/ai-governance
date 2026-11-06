import { useState } from 'react';
import { FileUp } from 'lucide-react';
import { useToast } from '../../lib/toast';
import { downloadFile } from '../../lib/format';
import { Button, Checkbox, Modal } from '../../components/ui';

export function ImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [dry, setDry] = useState(true);
  const template = 'type,name,description,platform,owner_email,sponsor_email,business_unit\nagent,Claims Triage Agent,Routes motor claims,Azure AI Foundry,rahul.menon@corp.com,kavya.reddy@corp.com,Customer Service';
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import from CSV"
      description="Bulk-register applications, agents, tools or data sources. Each row is validated before anything is created."
      footer={
        <>
          <Button variant="ghost" onClick={() => downloadFile('dg-catalyst-import-template.csv', template, 'text/csv')}>
            Download template
          </Button>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!file}
            onClick={() => {
              toast({ tone: 'success', title: dry ? 'Validation passed' : 'Import started', body: dry ? `${file!.name}: no errors found. Run again without dry run to import.` : `${file!.name} is being imported. You'll get a notification when it finishes.` });
              onClose();
            }}
          >
            {dry ? 'Validate file' : 'Import'}
          </Button>
        </>
      }
    >
      <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border-strong bg-surface-2/40 px-6 py-10 text-center hover:border-primary/50 hover:bg-primary/5">
        <FileUp className="h-6 w-6 text-subtle" />
        <span className="mt-2 text-sm font-medium">{file ? file.name : 'Choose a CSV file'}</span>
        <span className="mt-0.5 text-xs text-muted">{file ? `${(file.size / 1024).toFixed(1)} KB` : 'Up to 5,000 rows, UTF-8'}</span>
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <div className="mt-4">
        <Checkbox checked={dry} onChange={setDry} label="Dry run" description="Check every row against the schema and report errors without creating anything." />
      </div>
    </Modal>
  );
}
