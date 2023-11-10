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
                            let selected_value = !select_values.length ? filter[id] : Object.values(x.select).find(s=>{
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
}
