import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { InternalAssigneeOption } from "@/hooks/useInternalAssigneeOptions";

interface AssigneeComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: InternalAssigneeOption[];
  loading?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

export function AssigneeCombobox({
  value,
  onChange,
  options,
  loading = false,
  placeholder = "Selecione um responsavel",
  disabled = false,
}: AssigneeComboboxProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {value || (loading ? "Carregando responsaveis..." : placeholder)}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder="Buscar responsavel..." />
          <CommandList>
            <CommandEmpty>{loading ? "Carregando responsaveis..." : "Nenhum responsavel encontrado."}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="Sem responsavel"
                onSelect={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                <Check className={cn("mr-2 h-4 w-4", value ? "opacity-0" : "opacity-100")} />
                Sem responsavel
              </CommandItem>
              {options.map((option) => (
                <CommandItem
                  key={option.userId}
                  value={option.displayName}
                  onSelect={() => {
                    onChange(option.displayName);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.displayName ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {option.displayName}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
