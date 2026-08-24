import { useState } from 'react';
import { Search, Filter } from 'lucide-react';
import { SearchResults } from '@/components/search/search-results';
import { FilterPanel } from '@/components/search/filter-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

export function SearchPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    category: '',
    dateFrom: '',
    dateTo: '',
    includeCompleted: true,
    includeTimeBlocks: true,
    includeTasks: true,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);

  const handleSearch = () => {
    setSearchPerformed(true);
  };

  const clearFilters = () => {
    setFilters({
      status: '',
      priority: '',
      category: '',
      dateFrom: '',
      dateTo: '',
      includeCompleted: true,
      includeTimeBlocks: true,
      includeTasks: true,
    });
  };

  const hasActiveFilters = Object.values(filters).some(
    v => v !== '' && v !== true
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Search</h1>
        <p className="text-sm text-muted-foreground">
          Search across all your tasks, time blocks, and completed items
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks and time blocks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <Button onClick={() => setShowFilters(!showFilters)} variant={showFilters ? 'default' : 'outline'}>
              <Filter className="size-4 mr-2" />
              Filters
              {hasActiveFilters && <span className="ml-2 size-2 rounded-full bg-primary" />}
            </Button>
            <Button onClick={handleSearch} disabled={!searchQuery.trim()}>
              Search
            </Button>
          </div>

          {showFilters && (
            <div className="mt-4 border-t pt-4">
              <FilterPanel
                filters={filters}
                onFiltersChange={setFilters}
                onClear={clearFilters}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {searchPerformed && (
        <SearchResults
          query={searchQuery}
          filters={filters}
        />
      )}

      {!searchPerformed && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Search className="mx-auto size-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">Start searching</p>
            <p className="text-sm mt-2">
              Enter a search term above to find tasks and time blocks
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
