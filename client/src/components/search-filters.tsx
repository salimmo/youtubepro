import { UploadDateFilter, DurationFilter, SortBy, LanguageFilter } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";

interface SearchFiltersProps {
  uploadDate: UploadDateFilter;
  duration: DurationFilter;
  sortBy: SortBy;
  language: LanguageFilter;
  onUploadDateChange: (value: UploadDateFilter) => void;
  onDurationChange: (value: DurationFilter) => void;
  onSortByChange: (value: SortBy) => void;
  onLanguageChange: (value: LanguageFilter) => void;
}

// Die label-Felder sind Wörterbuch-Schlüssel (locales/video.*.ts).
const uploadDateOptions = [
  { value: UploadDateFilter.ANY, label: "video.uploadDate.any" },
  { value: UploadDateFilter.HOUR, label: "video.uploadDate.hour" },
  { value: UploadDateFilter.TODAY, label: "video.uploadDate.today" },
  { value: UploadDateFilter.WEEK, label: "video.uploadDate.week" },
  { value: UploadDateFilter.MONTH, label: "video.uploadDate.month" },
  { value: UploadDateFilter.YEAR, label: "video.uploadDate.year" },
];

const durationOptions = [
  { value: DurationFilter.ANY, label: "video.duration.any" },
  { value: DurationFilter.SHORT, label: "video.duration.short" },
  { value: DurationFilter.MEDIUM, label: "video.duration.medium" },
  { value: DurationFilter.LONG, label: "video.duration.long" },
];

const sortByOptions = [
  { value: SortBy.RELEVANCE, label: "video.sort.relevance" },
  { value: SortBy.DATE, label: "video.sort.date" },
  { value: SortBy.VIEW_COUNT, label: "video.sort.viewCount" },
  { value: SortBy.RATING, label: "video.sort.rating" },
  { value: SortBy.OUTLIER, label: "video.sort.outlier" },
];

const languageOptions = [
  { value: LanguageFilter.ANY, label: "video.language.any" },
  { value: LanguageFilter.GERMAN, label: "video.language.german" },
  { value: LanguageFilter.ENGLISH, label: "video.language.english" },
];

export function SearchFilters({
  uploadDate,
  duration,
  sortBy,
  language,
  onUploadDateChange,
  onDurationChange,
  onSortByChange,
  onLanguageChange,
}: SearchFiltersProps) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="filter-upload-date" className="text-xs text-muted-foreground">{t("video.filter.uploadDate")}</Label>
        <Select value={uploadDate} onValueChange={onUploadDateChange}>
          <SelectTrigger id="filter-upload-date" className="w-[140px]" data-testid="select-upload-date">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {uploadDateOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {t(option.label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filter-duration" className="text-xs text-muted-foreground">{t("video.filter.duration")}</Label>
        <Select value={duration} onValueChange={onDurationChange}>
          <SelectTrigger id="filter-duration" className="w-[150px]" data-testid="select-duration">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {durationOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {t(option.label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filter-sort-by" className="text-xs text-muted-foreground">{t("video.filter.sortBy")}</Label>
        <Select value={sortBy} onValueChange={onSortByChange}>
          <SelectTrigger id="filter-sort-by" className="w-[130px]" data-testid="select-sort-by">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sortByOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {t(option.label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="filter-language" className="text-xs text-muted-foreground">{t("video.filter.language")}</Label>
        <Select value={language} onValueChange={onLanguageChange}>
          <SelectTrigger id="filter-language" className="w-[140px]" data-testid="select-language">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {languageOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {t(option.label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
