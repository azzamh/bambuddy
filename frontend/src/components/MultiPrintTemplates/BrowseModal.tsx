import { useMemo, type ReactElement } from 'react';
import { X } from 'lucide-react';
import type { Archive, LibraryFolderTree, LibraryFileListItem } from '../../api/client';
import { Button } from '../Button';
import { Card, CardContent } from '../Card';

interface BrowseModalProps {
  sourceType: 'archive' | 'library';
  browseSearch: string;
  onSearchChange: (search: string) => void;
  browseArchives: Archive[];
  browseLibraryFolders: LibraryFolderTree[];
  selectedLibraryFolderId: number | null;
  onSelectLibraryFolder: (folderId: number) => void;
  onClearLibraryFolder: () => void;
  browseLibraryFiles: LibraryFileListItem[];
  onSelectItem: (itemId: number) => Promise<void>;
  onClose: () => void;
  /** Library-mode folder search (independent filter) */
  folderSearch: string;
  onFolderSearchChange: (search: string) => void;
  /** Library-mode file search (independent filter) */
  fileSearch: string;
  onFileSearchChange: (search: string) => void;
}

export function BrowseModal({
  sourceType,
  browseSearch,
  onSearchChange,
  browseArchives,
  browseLibraryFolders,
  selectedLibraryFolderId,
  onSelectLibraryFolder,
  onClearLibraryFolder,
  browseLibraryFiles,
  onSelectItem,
  onClose,
  folderSearch,
  onFolderSearchChange,
  fileSearch,
  onFileSearchChange,
}: BrowseModalProps) {
  // no i18n needed in this modal currently

  const renderLibraryFolders = (folders: LibraryFolderTree[], depth = 0): ReactElement[] =>
    folders.flatMap((folder) => {
      const isSelected = selectedLibraryFolderId === folder.id;
      const hasChildren = folder.children.length > 0;
      return [
        <button
          key={folder.id}
          type="button"
          className={`w-full px-3 py-2 text-left transition-colors rounded-md ${
            isSelected ? 'bg-bambu-green/20 text-white' : 'hover:bg-bambu-dark-tertiary text-bambu-gray'
          }`}
          style={{ paddingLeft: `${depth * 14 + 12}px` }}
          onClick={() => onSelectLibraryFolder(folder.id)}
        >
          <div className="text-sm font-medium">{folder.name}</div>
          <div className="text-xs opacity-80">
            Folder #{folder.id} · {folder.file_count} files{hasChildren ? ` · ${folder.children.length} subfolders` : ''}
          </div>
        </button>,
        ...renderLibraryFolders(folder.children, depth + 1),
      ];
    });

  const filteredArchives = useMemo(
    () =>
      browseArchives.filter((archive: Archive) => {
        const q = browseSearch.trim().toLowerCase();
        if (!q) return true;
        return (
          archive.filename.toLowerCase().includes(q) ||
          (archive.print_name || '').toLowerCase().includes(q) ||
          String(archive.id).includes(q)
        );
      }),
    [browseArchives, browseSearch]
  );

  const filteredLibraryFolders = useMemo(() => {
    const q = folderSearch.trim().toLowerCase();
    if (!q) return browseLibraryFolders;
    const filterTree = (folders: LibraryFolderTree[]): LibraryFolderTree[] =>
      folders.reduce<LibraryFolderTree[]>((acc, folder) => {
        const nameMatch = folder.name.toLowerCase().includes(q);
        const filteredChildren = filterTree(folder.children);
        if (nameMatch || filteredChildren.length > 0) {
          acc.push({
            ...folder,
            children: nameMatch ? folder.children : filteredChildren,
          });
        }
        return acc;
      }, []);
    return filterTree(browseLibraryFolders);
  }, [browseLibraryFolders, folderSearch]);

  const filteredLibraryFiles = useMemo(
    () =>
      browseLibraryFiles.filter((file: LibraryFileListItem) => {
        const q = fileSearch.trim().toLowerCase();
        if (!q) return true;
        return file.filename.toLowerCase().includes(q) || String(file.id).includes(q);
      }),
    [browseLibraryFiles, fileSearch]
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardContent className="p-0">
          <div className="flex items-center justify-between p-4 border-b border-bambu-dark-tertiary">
            <div>
              <h3 className="text-lg font-semibold text-white">
                Browse {sourceType === 'archive' ? 'archives' : 'File Manager'}
              </h3>
              <p className="text-xs text-bambu-gray">
                Select an item to fill the source field above.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="p-4 space-y-4">
            {sourceType === 'archive' ? (
              <div>
                <label className="block mb-1 text-xs text-bambu-gray">Search by name</label>
                <input
                  className="w-full px-3 py-2 text-white border rounded-md border-bambu-border bg-bambu-dark"
                  value={browseSearch}
                  onChange={(e: { target: { value: string } }) => onSearchChange(e.target.value)}
                  placeholder="Search archives..."
                />
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <label className="block mb-1 text-xs text-bambu-gray">Search folders</label>
                  <input
                    className="w-full px-3 py-2 text-white border rounded-md border-bambu-border bg-bambu-dark"
                    value={folderSearch}
                    onChange={(e: { target: { value: string } }) => onFolderSearchChange(e.target.value)}
                    placeholder="Search folders by name..."
                  />
                </div>
                <div>
                  <label className="block mb-1 text-xs text-bambu-gray">Search files</label>
                  <input
                    className="w-full px-3 py-2 text-white border rounded-md border-bambu-border bg-bambu-dark"
                    value={fileSearch}
                    onChange={(e: { target: { value: string } }) => onFileSearchChange(e.target.value)}
                    placeholder="Search files by name..."
                  />
                </div>
              </div>
            )}

            <div className="max-h-[55vh] overflow-y-auto rounded-lg border border-bambu-border">
              {sourceType === 'archive' ? (
                <div className="divide-y divide-bambu-border">
                  {filteredArchives.map((archive: Archive) => (
                    <button
                      key={archive.id}
                      type="button"
                      className="w-full px-4 py-3 text-left transition-colors hover:bg-bambu-dark-tertiary"
                      onClick={() => onSelectItem(archive.id)}
                    >
                      <div className="text-sm font-medium text-white">
                        {archive.print_name || archive.filename}
                      </div>
                      <div className="text-xs text-bambu-gray">
                        Archive #{archive.id} · {archive.filename}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
                  <div className="p-3 border rounded-lg border-bambu-border bg-bambu-dark">
                    <div className="mb-2 text-xs font-semibold tracking-wide uppercase text-bambu-gray">
                      Folders
                    </div>
                    <div className="space-y-1 max-h-[48vh] overflow-y-auto pr-1">
                      {filteredLibraryFolders.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-bambu-gray">
                          No folders found
                        </div>
                      ) : (
                        renderLibraryFolders(filteredLibraryFolders)
                      )}
                    </div>
                  </div>

                  <div className="p-3 border rounded-lg border-bambu-border bg-bambu-dark">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div>
                        <div className="text-xs font-semibold tracking-wide uppercase text-bambu-gray">
                          Files
                        </div>
                        <div className="text-sm text-white">
                          {selectedLibraryFolderId
                            ? `Folder #${selectedLibraryFolderId}`
                            : 'Select a folder to browse its files'}
                        </div>
                      </div>
                      {selectedLibraryFolderId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={onClearLibraryFolder}
                        >
                          Clear
                        </Button>
                      )}
                    </div>

                    {!selectedLibraryFolderId ? (
                      <div className="p-4 text-sm border border-dashed rounded-md border-bambu-border text-bambu-gray">
                        Select a folder from the left to load the files inside it.
                      </div>
                    ) : filteredLibraryFiles.length === 0 ? (
                      <div className="p-4 text-sm border border-dashed rounded-md border-bambu-border text-bambu-gray">
                        No files found in this folder.
                      </div>
                    ) : (
                      <div className="divide-y divide-bambu-border overflow-y-auto max-h-[40vh] rounded-md border border-bambu-border">
                        {filteredLibraryFiles.map((file: LibraryFileListItem) => (
                          <button
                            key={file.id}
                            type="button"
                            className="w-full px-4 py-3 text-left transition-colors hover:bg-bambu-dark-tertiary"
                            onClick={() => onSelectItem(file.id)}
                          >
                            <div className="text-sm font-medium text-white">{file.filename}</div>
                            <div className="text-xs text-bambu-gray">Library file #{file.id}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
