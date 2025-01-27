import { App, debounce, Plugin, PluginSettingTab, setIcon, Setting } from 'obsidian';

interface GraphFilterSettings {
    filters: string[];
}

const DEFAULT_SETTINGS: GraphFilterSettings = {
    filters: []
}

export default class GraphFiltersPlugin extends Plugin {
    settings: GraphFilterSettings;
    private filtersContainer: HTMLElement;
    private searchInput: HTMLInputElement | null;
    private secondaryInput: HTMLInputElement | null;
    private debouncedUpdate: (index: number, value: string) => void;
    private existingSecondaryInput: boolean = false;

    async onload() {
        await this.loadSettings();
        this.initializeDebouncer();

        this.app.workspace.on('active-leaf-change', (leaf) => {
            console.log(leaf?.view.getViewType())

            if (leaf?.view.getViewType() === 'graph' || leaf?.view.getViewType() === 'bookmarks' ) {
                // Add slight delay to ensure graph DOM is ready
                this.initializeComponents()
                // setTimeout(() => this.initializeComponents(), 50);
            }
        });
    }

    private initializeDebouncer() {
        this.debouncedUpdate = debounce(
            (index: number, value: string) => {
                if (index >= 0 && index < this.settings.filters.length) {
                    this.settings.filters[index] = value.trim();
                    this.saveSettings();
                    this.updateSearchQuery();
                }
            },
            300,
            true
        );
    }

    private createSecondaryInput() {
        const controls = document.querySelector('.graph-controls .setting-item.mod-search-setting');
        if (!controls || this.existingSecondaryInput) {
            console.log(!controls, this.existingSecondaryInput)
            return
        };

        console.log("adding") //doesn't run

        const inputContainer = document.createElement('div');
        inputContainer.className = 'search-input-container';
        
        this.secondaryInput = document.createElement('input');
        this.secondaryInput.type = 'search';
        this.secondaryInput.placeholder = 'Add filter (Ctrl+Enter)';
        this.secondaryInput.classList.add('graph-filter-input');
        
        inputContainer.appendChild(this.secondaryInput);
        controls.parentNode?.insertBefore(inputContainer, controls.nextSibling);
        this.existingSecondaryInput = true;
    }

    private registerInputHandler(input: HTMLInputElement | null) {
        if (!input) return;

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey && !e.isComposing) {
                e.preventDefault();
                this.handleNewFilter(input);
            }
        });
    }

    private initializeComponents() {
        //this.cleanupElements(); // Clean up first
        this.createPillsContainer();
        this.createSecondaryInput();
        this.registerSearchHandlers();
        this.initializeMainInput();

        // Always parse current input value, even if filters exist
        if (this.searchInput) {
            const newFilters = this.searchInput.value
                .split('   AND   ')
                .map(f => f.trim())
                .filter(f => f.length > 0);

            // Update filters only if different
            if (JSON.stringify(newFilters) !== JSON.stringify(this.settings.filters)) {
                this.settings.filters = newFilters;
                this.saveSettings();
            }
        }

        this.renderPills();  // Always render pills after initialization
    }

    private initializeMainInput() {
        this.searchInput = document.querySelector(
            '.graph-controls .search-input-container input'
        ) as HTMLInputElement;
    
        if (this.searchInput) {
            // Add event listener for input changes
            this.searchInput.addEventListener('input', () => this.handleSearchInputChange());
        }
    }
    
    private handleSearchInputChange() {
        if (!this.searchInput) return;
    
        const currentValue = this.searchInput.value;
        // Split using '   AND   ' to match the join separator
        const newFilters = currentValue.split('   AND   ')
            .map(f => f.trim())
            .filter(f => f.length > 0);
    
        // Check if filters have actually changed
        if (JSON.stringify(newFilters) !== JSON.stringify(this.settings.filters)) {
            this.settings.filters = newFilters;
            this.saveSettings();
            this.renderPills();
        }
    }

    private createPillsContainer() {
        const controls = document.querySelector('.graph-controls .setting-item.mod-search-setting');
        if (!controls || this.filtersContainer?.isConnected) return;

        this.filtersContainer = document.createElement('div');
        this.filtersContainer.className = 'graph-filters-pills';
        controls.parentNode?.insertBefore(this.filtersContainer, controls.nextSibling);
    }

    private renderPills() {
        this.filtersContainer?.empty();
        this.settings.filters.forEach((filter, index) => {
            const pill = this.filtersContainer.createDiv({
                cls: 'pill-container graph-color-group',
            });

            const input = pill.createEl('input', { 
                cls: 'pill-input',
                attr: {
                    'data-index': index.toString(),
                    'spellcheck': 'false'
                }
            });
            input.value = filter;
            input.type = 'text';
            
            input.addEventListener('input', (e) => {
                const target = e.target as HTMLInputElement;
                this.debouncedUpdate(index, target.value);
            });

            const removeButton = pill.createDiv({ cls: 'clickable-icon' });
            setIcon(removeButton, 'x');
            
            removeButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeFilter(index);
            });
        });
    }

    private handleNewFilter(sourceInput?: HTMLInputElement) {
        const input = sourceInput || this.searchInput;
        if (!input) return;

        const value = input.value.trim();
        if (value) {
            this.settings.filters.push(value);
            input.value = '';
            this.saveSettings();
            this.updateSearchQuery();
            this.renderPills();
        }
    }

    private removeFilter(index: number) {
        this.settings.filters.splice(index, 1);
        this.saveSettings();
        this.updateSearchQuery();
        this.renderPills();
    }

    private updateSearchQuery() {
        if (!this.searchInput) return;

        // Update the input value directly without cloning
        const combinedQuery = this.settings.filters.join('   AND   ');
        this.searchInput.value = combinedQuery;

        // Create proper input event
        const inputEvent = new Event('input', {
            bubbles: true,
            cancelable: true
        });

        // Dispatch the event and let Obsidian handle the rest
        this.searchInput.dispatchEvent(inputEvent);

        // Add slight delay for UI refresh
        setTimeout(() => {
            this.searchInput?.dispatchEvent(new Event('change', { bubbles: true }));
        }, 10);
    }

    private registerSearchHandlers() {
        // Remove the main input keydown override
        // Only handle secondary input
        this.registerInputHandler(this.secondaryInput);
    }

    async loadSettings() {
        this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData()) };
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}