import { UploadDateFilter, DurationFilter, SortBy } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface SearchFiltersProps {
  uploadDate: UploadDateFilter;
  duration: DurationFilter;
  sortBy: SortBy;
  onUploadDateChange: (value: UploadDateFilter) => void;
  onDurationChange: (value: DurationFilter) => void;
  onSortByChange: (value: SortBy) => void;
}

const uploadDateOptions = [
  { value: UploadDateFilter.ANY, label: "Beliebig" },
  { value: UploadDateFilter.HOUR, label: "Letzte Stunde" },
  { value: UploadDateFilter.TODAY, label: "Heute" },
  { value: UploadDateFilter.WEEK, label: "Diese Woche" },
  { value: UploadDateFilter.MONTH, label: "Dieser Monat" },
  { value: UploadDateFilter.YEAR, label: "Dieses Jahr" },
];

const durationOptions = [
  { value: DurationFilter.ANY, label: "Beliebige Dauer" },
  { value: DurationFilter.SHORT, label: "Kurz (< 4 Min.)" },
  { value: DurationFilter.MEDIUM, label: "Mittel (4–20 Min.)" },
  { value: DurationFilter.LONG, label: "Lang (> 20 Min.)" },
];

const sortByOptions = [
  { value: SortBy.RELEVANCE, label: "Relevanz" },
  { value: SortBy.DATE, label: "Upload-Datum" },
  { value: SortBy.VIEW_COUNT, label: "Aufrufe" },
  { value: SortBy.RATING, label: "Bewertung" },
];

export function SearchFilters({
  uploadDate,
  duration,
  sortBy,
  onUploadDateChange,
  onDurationChange,
  onSortByChange,
}: SearchFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="filter-upload-date" className="text-xs text-muted-foreground">Upload-Datum</Label>
        <Select value={uploadDate} onValueChange={onUploadDateChange}>
          <SelectTrigger id="filter-upload-date" className="w-[140px]" data-testid="select-upload-date">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {uploadDateOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filter-duration" className="text-xs text-muted-foreground">Dauer</Label>
        <Select value={duration} onValueChange={onDurationChange}>
          <SelectTrigger id="filter-duration" className="w-[150px]" data-testid="select-duration">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {durationOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filter-sort-by" className="text-xs text-muted-foreground">Sortieren nach</Label>
        <Select value={sortBy} onValueChange={onSortByChange}>
          <SelectTrigger id="filter-sort-by" className="w-[130px]" data-testid="select-sort-by">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sortByOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
