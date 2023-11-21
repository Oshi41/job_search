const {useState, useEffect, useMemo, useRef, useCallback} = React;
const {
    colors,
    CssBaseline,
    ThemeProvider,
    Typography,
    Container,
    createTheme,
    Box,
    Card,
    SvgIcon,
    Link,
    Table,
    TableHead,
    TableRow,
    TableBody,
    TableCell,
    TableContainer,
    TableSortLabel,
    TablePagination,
    TableFooter,
    Paper,
    Popover,
    Switch,
    CircularProgress,
    Skeleton,
    Snackbar,
    Alert,
    IconButton,
    Icon,
    Stack,
    TextField,
    Tooltip,
    Button,
    Modal,
    MenuItem,
    DatePicker,
} = MaterialUI;

const to_arr = obj => Array.isArray(obj) ? obj : [obj];

/**
 * @returns {[boolean,((function(*): void)|*)]}
 */
window.use_increment_loading = function () {
    const [l, set_l] = useState(0);
    const set_loading = useCallback((is_loading) => {
        set_l(prev => {
            return is_loading ? prev + 1 : prev - 1;
        });
    }, [set_l]);
    return useMemo(() => [l > 0, set_loading], [l, set_loading]);
};

/**
 * @param fn {()=>Promise}
 * @param set_loading {function}
 * @param add_snackbar {function}
 * @param header {string}
 * @param deps {Array}
 * @returns {(function(...[*]): void)|*}
 */
window.use_async_callback = (fn, {set_loading, add_snackbar, err_hdr}, deps) => {
    return useCallback((...args) => {
        async function load() {
            try {
                set_loading(true);
                await fn(...args);
            } catch (e) {
                console.error(err_hdr, e);
                add_snackbar(err_hdr + ' ' + e.message, 'error');
            } finally {
                set_loading(false);
            }
        }

        load();
    }, [...deps, add_snackbar, set_loading, err_hdr]);
}

const use_debounce_effect = (fn, mls, deps) => {
    let timer_ref = useRef(null);
    let is_exec_ref = useRef(false);
    useEffect(() => {
        if (is_exec_ref.current)
            return;
        if (timer_ref.current)
            clearTimeout(timer_ref.current);
        timer_ref.current = setTimeout(async function execute() {
            try {
                is_exec_ref.current = true;
                await fn();
            } finally {
                is_exec_ref.current = false;
            }
        }, mls);
    }, deps);
}

/**
 * @returns {[URL,(function(URL | function(URL): URL): URL)]}
 */
window.use_location = function () {
    let href = window.location.toString();
    const url = useMemo(() => new URL(href), [href]);
    const set_url = useCallback((url_or_fn) => {
        if (typeof url_or_fn == 'string') {
            let str = url_or_fn;
            url_or_fn = () => new URL(str);
        }
        if (url_or_fn instanceof URL) {
            let _url = url_or_fn;
            url_or_fn = () => _url;
        }
        if (typeof url_or_fn != 'function') {
            throw new Error('url_or_fn must be a string/URL/function');
        }
        let copy = new URL(url.toString());
        let updated = url_or_fn(copy) || copy;
        if (updated.toString() != url.toString()) {
            window.history.pushState({url: updated.toString()}, '', updated);
        }
        // window.location.assign(updated);
    }, [url]);
    return useMemo(() => [url, set_url,], [url, set_url]);
};
window.use_query_param = function (name, default_value) {
    const [url, set_url] = window.use_location();
    const value = useMemo(() => url.searchParams.get(name), [url]);
    const set_value = useCallback((str) => set_url(prev => {
        prev.searchParams.set(name, str);
        return prev;
    }), [value, url]);
    useEffect(() => void (!value && set_value(default_value)), [default_value]);
    return useMemo(() => [value, set_value], [value, set_value]);
}
window.use_tab_location = function (init_path, to_clear = []) {
    const [url, set_url] = window.use_location();
    const value = useMemo(() => {
        let result = url.pathname.replace(init_path, '');
        if (result == '/')
            result = '';
        return result;
    }, [url]);
    const set_value = useCallback(str => set_url(prev => {
        let pathname = [init_path, str].filter(Boolean).join('');
        prev.pathname = pathname;
        for (let key of to_clear) {
            prev[key] = '';
        }
        return prev;
    }), [set_url]);
    return useMemo(() => [value, set_value], [value, set_value]);
}
/**
 * @param columns {Array} Table columns
 * @param id_prefix {string}
 * @param push2history {any} should update state from history?
 * @returns {[{},((value: (((prevState: {}) => {}) | {})) => void), function()]}
 */
window.use_table_history = function (columns, id_prefix, push2history) {
    const keys = useMemo(() => {
        return columns.filter(x => !x.disable_filter).map(x => x.id);
    }, [columns]);
    const [url, set_url] = window.use_location();
    const [obj, set_obj] = useState({});

    function url2state() {
        set_obj(prev => {
            let changed = false;
            for (let key of keys) {
                const history_id = id_prefix + key;
                if (url.searchParams.has(history_id)) {
                    let json = url.searchParams.get(history_id);
                    let prev_val = JSON.stringify(prev[key]);
                    if (json != prev_val) {
                        prev[key] = JSON.parse(json);
                        changed = true;
                    }
                } else if (prev.hasOwnProperty(key)) {
                    delete prev[key];
                    changed = true;
                }
            }
            return changed ? {...prev} : prev;
        });
    }

    useEffect(() => void (push2history && url2state()), [push2history]);
    useEffect(() => {
        set_url(prev => {
            for (let key of keys) {
                const history_id = id_prefix + key;
                if (obj.hasOwnProperty(key))
                    prev.searchParams.set(history_id, JSON.stringify(obj[key]));
                else
                    prev.searchParams.delete(history_id);
            }
        });
    }, [obj, keys.join(',')]);

    return [obj, set_obj];
};

window.use_custom_table = ({columns, data: _data, total, request_data, visible}) => {
    const [sort, set_sort] = use_table_history(columns, 's_', visible);
    const [filter, set_filter] = use_table_history(columns, 'f_', visible);
    const [page, set_page] = useState(0);
    const [page_size, set_page_size] = useState(10);
    const [selected, set_selected] = useState(null);
    const [loading, set_loading] = useState(false);
    const on_update = useCallback((opts) => {
        let {
            filter: _filter,
            sort: _sort,
            page: _page,
            page_size: _page_size,
            selected: _selected,
        } = opts;
        if (_filter)
            set_filter(_filter);
        if (_sort)
            set_sort(_sort);
        if (Number.isInteger(_page))
            set_page(_page);
        if (Number.isInteger(_page_size))
            set_page_size(_page_size);
        if (_selected)
            set_selected(_selected);
    }, [set_filter, set_sort, set_page, set_page_size, set_selected]);
    const [data, set_data] = useState([]);
    const request_client_data = useCallback(() => {
        const sort_by = (l, r) => {
            for (let [key, direction] of Object.entries(sort)) {
                let left, right;
                if (direction < 0) {
                    right = l[key];
                    left = r[key];
                } else {
                    left = l[key];
                    right = r[key];
                }

                let diff = 0;
                if (left && left.localCompare)
                    diff = left.localCompare(right);
                else
                    diff = +(left - right);
                if (diff)
                    return diff;
            }
            return 0;
        };
        const filter_by = x => {
            for (let [key, filter_value] of Object.entries(filter)) {
                let src = (x[key] + '').toLowerCase();
                if (filter_value instanceof RegExp && filter_value.test(src))
                    return true;
                if (typeof filter_value == 'string' && src.includes(filter_value.toLowerCase()))
                    return true;
                if (src == filter_value)
                    return true;
                return !filter_value;
            }
            return true;
        };
        /** @type {Array} */
        let result = _data.sort(sort_by).filter(filter_by);
        result = result.slice(page * page_size, page_size);
        set_data(result);
    }, [filter, sort, page, page_size, _data]);

    // copy data
    useEffect(() => {
        set_data([..._data]);
    }, [_data]);

    // client side sorting
    useEffect(() => {
        if (!request_data)
            request_client_data();
    }, [request_client_data]);

    // request server side data
    useEffect(() => {
        async function load() {
            if (request_data) {
                try {
                    set_loading(true);
                    await request_data({filter, sort, page, page_size});
                } finally {
                    set_loading(false);
                }
            }
        }

        load();
    }, [filter, sort, page, page_size]);

    return useMemo(() => ({
        columns,
        data,
        sort,
        set_sort,
        filter,
        set_filter,
        page,
        page_size,
        loading,
        selected,
        on_update,
        total: Number.isInteger(total) || data.length || 0,
    }), [columns, data, sort, set_sort, filter, set_filter, page, page_size, loading, selected, on_update, total]);
};

window.CustomTable = ({columns, data, sort, filter, page, page_size, on_update, loading, total, selected}) => {
    let options = [5, 10, 25, 50, {label: 'All', value: Number.MAX_VALUE}];

    return <TableContainer component={Paper}>
        <Table>
            <TableHead>
                <TableRow>
                    {
                        columns.map(x => {
                            let header = typeof x.header == 'function' ? x.header() : x.header;
                            let id = x.id;
                            let can_filter = !x.disable_filter;
                            let can_sort = !x.disable_sort;
                            let select_values = Object.entries(x.select || {})
                                .map(([label, value], i) => {
                                    return <MenuItem key={i} value={value}>
                                        {label}
                                    </MenuItem>
                                });
                            let default_value = Object.values(x.select || {})[0];
                            let selected_value = !select_values.length ? filter[id] : Object.values(x.select).find(s => {
                                if (typeof s == 'string')
                                    return filter[id] === s;
                                if (s.no_search)
                                    return false;
                                if (s.hasOwnProperty('search'))
                                    return s.search === filter[id];
                                return false;
                            });

                            return <TableCell key={id}>
                                <div>
                                    <Stack direction="row">
                                        {can_sort && <TableSortLabel active={sort.hasOwnProperty(id)}
                                                                     direction={sort[id]}
                                                                     onClick={e => {
                                                                         let copy = !!e.ctrlKey ? {...sort} : {};
                                                                         let prev = sort[id];
                                                                         copy[id] = prev == 'asc' ? 'desc' : 'asc';
                                                                         on_update({sort: copy,});
                                                                     }}/>}
                                        <Typography>{header}</Typography>
                                    </Stack>
                                    {can_filter && <TextField select={select_values.length > 0}
                                                              defaultValue={default_value}
                                                              value={selected_value || ''}
                                                              fullWidth
                                                              onChange={e => {
                                                                  let new_val = e.target.value;
                                                                  if (new_val.no_search)
                                                                      new_val = '';
                                                                  if (new_val.hasOwnProperty('search'))
                                                                      new_val = new_val.search;
                                                                  let copy = {...filter, [id]: new_val};
                                                                  if (typeof new_val == 'string' && new_val.length == 0)
                                                                      delete copy[id];
                                                                  on_update({filter: copy});
                                                              }}>
                                        {select_values}
                                    </TextField>}
                                </div>
                            </TableCell>
                        })
                    }
                </TableRow>
            </TableHead>
            <TableBody>
                {data.map(x => {
                    return <TableRow onClick={e => {
                        on_update({selected: x})
                    }}
                                     selected={selected === x || (Array.isArray(selected) && selected.includes(x))}>
                        {columns.map(c => {
                            let id = to_arr(x.filters).map(p => x[p]).join('_') || x.sort_by;
                            let cell_content;
                            if (loading)
                                cell_content = <Skeleton variant="text"/>;
                            else if (typeof c.cell == "function")
                                cell_content = c.cell(x);
                            else if (c.sort_by)
                                cell_content = x[c.sort_by];

                            return <TableCell key={id}>{cell_content}</TableCell>;
                        })}
                    </TableRow>
                })}
            </TableBody>
            <TableFooter>
                <TableRow>
                    <TablePagination rowsPerPageOptions={options}
                                     count={total}
                                     page={page}
                                     rowsPerPage={page_size}
                                     onPageChange={(e, p) => on_update({
                                         page: p,
                                     })}
                                     onRowsPerPageChange={e => on_update({
                                         page: 0,
                                         page_size: +e.target.value,
                                     })}
                    />
                </TableRow>
            </TableFooter>
        </Table>
    </TableContainer>
};

window.CustomTabs = function ({tabs, tab_props, base_url}) {
    const [url, set_url] = window.use_tab_location(base_url, ['search', 'hash']);
    const [tab, set_tab] = useState(0);
    const _tabs = tabs || [];
    const headers = _tabs.map(x => x.header).map((x, i) => <Tab label={x} value={i} key={i}/>);
    const contents = _tabs.map((x, i) => {
        let opts = {
            ...tab_props,
            visible: i == tab,
        };
        return x.content(opts);
    });

    useEffect(() => {
        let find_tab = Math.max(0, tabs.findIndex(x => x.href && url.includes(x.href)));
        set_tab(find_tab);

        // client navigate
        if (!url) {
            let selected_tab = tabs[find_tab];
            if (selected_tab && selected_tab.href)
                set_url(selected_tab.href);
        }
    }, [url]);

    return [
        <Tabs value={tab} onChange={(e, i) => {
            set_tab(i);
            set_url(tabs[i].href);
        }}>
            {headers}
        </Tabs>,
        contents[tab],
    ];
}
