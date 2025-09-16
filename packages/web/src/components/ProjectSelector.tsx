import { Autocomplete, TextField } from '@mui/material';


const ProjectSelector = ({ selectedProject, setSelectedProject, projects}: { selectedProject: any, setSelectedProject: any, projects: any}) => {
    return (
        <Autocomplete
            sx={{ padding: '1rem' }}
            value={selectedProject}
            onChange={(event, newValue) => setSelectedProject(newValue)}
            isOptionEqualToValue={(option, value) => option?.id === value?.id}
            options={projects}
            getOptionLabel={(option) => option?.name || ''}
            fullWidth
            renderInput={(params) => <TextField {...params} label="Proyecto" variant="outlined" />}
        />
    );
};

export default ProjectSelector;