import { useState, useEffect } from 'react';
import { Link2, Plus, X, MessageSquare, Map, Sparkles, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';

const linkTypeConfig = {
  feedback: { icon: MessageSquare, label: 'Feedback', color: 'text-blue-600', page: 'Feedback', param: 'id' },
  roadmap: { icon: Map, label: 'Roadmap', color: 'text-purple-600', page: 'Roadmap', param: 'item' },
  changelog: { icon: Sparkles, label: 'Changelog', color: 'text-green-600', page: 'Changelog', param: 'entry' },
  docs: { icon: BookOpen, label: 'Docs', color: 'text-orange-600', page: 'Docs', param: 'doc' }
};

export default function LinksPanel({ 
  workspaceId, 
  itemType, // 'feedback', 'roadmap', 'changelog', 'docs'
  itemId,
  links, // { feedback_ids: [], roadmap_item_ids: [], changelog_entry_ids: [], doc_page_ids: [] }
  onUpdate,
  isStaff 
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [linkType, setLinkType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [availableItems, setAvailableItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [linkedData, setLinkedData] = useState({});

  useEffect(() => {
    loadLinkedData();
  }, [links]);

  const loadLinkedData = async () => {
    const data = {};
    
    if (links?.feedback_ids?.length) {
      const items = await Promise.all(
        links.feedback_ids.map(id => base44.entities.Feedback.filter({ id }).then(r => r[0]))
      );
      data.feedback = items.filter(Boolean);
    }
    
    if (links?.roadmap_item_ids?.length) {
      const items = await Promise.all(
        links.roadmap_item_ids.map(id => base44.entities.RoadmapItem.filter({ id }).then(r => r[0]))
      );
      data.roadmap = items.filter(Boolean);
    }
    
    if (links?.changelog_entry_ids?.length) {
      const items = await Promise.all(
        links.changelog_entry_ids.map(id => base44.entities.ChangelogEntry.filter({ id }).then(r => r[0]))
      );
      data.changelog = items.filter(Boolean);
    }
    
    if (links?.doc_page_ids?.length) {
      const items = await Promise.all(
        links.doc_page_ids.map(id => base44.entities.DocPage.filter({ id }).then(r => r[0]))
      );
      data.docs = items.filter(Boolean);
    }
    
    setLinkedData(data);
  };

  const handleOpenAddModal = (type) => {
    setLinkType(type);
    setSearchQuery('');
    setSelectedItems([]);
    loadAvailableItems(type);
    setShowAddModal(true);
  };

  const loadAvailableItems = async (type) => {
    let items = [];
    switch(type) {
      case 'feedback':
        items = await base44.entities.Feedback.filter({ workspace_id: workspaceId }, '-created_date');
        break;
      case 'roadmap':
        items = await base44.entities.RoadmapItem.filter({ workspace_id: workspaceId }, 'display_order');
        break;
      case 'changelog':
        items = await base44.entities.ChangelogEntry.filter({ workspace_id: workspaceId }, '-release_date');
        break;
      case 'docs':
        items = await base44.entities.DocPage.filter({ workspace_id: workspaceId, type: 'page' }, 'order');
        break;
    }
    setAvailableItems(items);
  };

  const handleAddLinks = async () => {
    if (selectedItems.length === 0) return;

    const fieldMap = {
      feedback: 'feedback_ids',
      roadmap: 'roadmap_item_ids',
      changelog: 'changelog_entry_ids',
      docs: 'doc_page_ids'
    };

    const field = fieldMap[linkType];
    const currentIds = links?.[field] || [];
    const newIds = [...new Set([...currentIds, ...selectedItems])];

    await updateLinks({ [field]: newIds });
    setShowAddModal(false);
    await loadLinkedData();
  };

  const handleRemoveLink = async (type, id) => {
    const fieldMap = {
      feedback: 'feedback_ids',
      roadmap: 'roadmap_item_ids',
      changelog: 'changelog_entry_ids',
      docs: 'doc_page_ids'
    };

    const field = fieldMap[type];
    const currentIds = links?.[field] || [];
    const newIds = currentIds.filter(i => i !== id);

    await updateLinks({ [field]: newIds });
    await loadLinkedData();
  };

  const updateLinks = async (updates) => {
    const entityMap = {
      feedback: 'Feedback',
      roadmap: 'RoadmapItem',
      changelog: 'ChangelogEntry',
      docs: 'DocPage'
    };

    await base44.entities[entityMap[itemType]].update(itemId, updates);
    onUpdate();
  };

  const filteredItems = availableItems.filter(item => {
    const title = item.title?.toLowerCase() || '';
    return title.includes(searchQuery.toLowerCase());
  });

  const hasLinks = Object.values(linkedData).some(arr => arr?.length > 0);

  return (
    <div className="bg-slate-50 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Link2 className="h-4 w-4" />
          Related Items
        </h4>
        {isStaff && (
          <Select onValueChange={handleOpenAddModal}>
            <SelectTrigger className="w-32 h-8">
              <Plus className="h-3 w-3 mr-1" />
              Add Link
            </SelectTrigger>
            <SelectContent>
              {Object.entries(linkTypeConfig)
                .filter(([key]) => key !== itemType)
                .map(([key, config]) => {
                  const Icon = config.icon;
                  return (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <Icon className={`h-3 w-3 ${config.color}`} />
                        {config.label}
                      </div>
                    </SelectItem>
                  );
                })}
            </SelectContent>
          </Select>
        )}
      </div>

      {!hasLinks && (
        <p className="text-xs text-slate-400">No linked items yet</p>
      )}

      {/* Display linked items */}
      {Object.entries(linkedData).map(([type, items]) => {
        if (!items?.length) return null;
        const config = linkTypeConfig[type];
        const Icon = config.icon;

        return (
          <div key={type} className="space-y-1.5">
            <p className="text-xs font-medium text-slate-500 uppercase">{config.label}</p>
            {items.map(item => (
              <div key={item.id} className="flex items-center justify-between gap-2 p-2 bg-white rounded-lg border border-slate-200">
                <a
                  href={`${createPageUrl(config.page)}?${config.param}=${type === 'docs' ? item.slug : item.id}`}
                  className="flex items-center gap-2 flex-1 hover:text-slate-900 transition-colors"
                >
                  <Icon className={`h-3 w-3 ${config.color}`} />
                  <span className="text-sm text-slate-700">{item.title}</span>
                </a>
                {isStaff && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveLink(type, item.id)}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        );
      })}

      {/* Add Links Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add {linkTypeConfig[linkType]?.label} Links</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Search</Label>
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search items..."
                className="mt-1.5"
              />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-2 border border-slate-200 rounded-lg p-3">
              {filteredItems.map(item => (
                <label
                  key={item.id}
                  className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedItems.includes(item.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedItems([...selectedItems, item.id]);
                      } else {
                        setSelectedItems(selectedItems.filter(id => id !== item.id));
                      }
                    }}
                    className="h-4 w-4"
                  />
                  <span className="text-sm text-slate-700">{item.title}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" onClick={() => setShowAddModal(false)}>Cancel</Button>
              <Button
                onClick={handleAddLinks}
                disabled={selectedItems.length === 0}
                className="bg-slate-900 hover:bg-slate-800"
              >
                Add {selectedItems.length} Link{selectedItems.length !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}