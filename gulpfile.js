const gulp = require('gulp');

gulp.task('build:icons', () => {
	return gulp.src('./custom-n8n-nodes/**/*.{png,svg}')
		.pipe(gulp.dest('./n8n-data/custom'));
});

gulp.task('default', gulp.series('build:icons'));
